"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Prisma, Role, type EntityKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { entityMeta } from "@/lib/entities/registry";
import { entityDelegate } from "@/lib/entities/resolve";
import { planUpserts, type ExistingEntity, type SyncRow } from "@/lib/entities/sync-types";
import { fetchSoftoneRows, type SoftoneSyncKind } from "@/lib/entities/sync-softone";
import { fetchWooRows } from "@/lib/entities/sync-woo";

type SyncSource = "SOFTONE" | "WOOCOMMERCE";

const SOFTONE_KINDS: EntityKind[] = ["SUPPLIER", "CUSTOMER", "PRODUCT", "PRODUCT_CATEGORY"];
// Το Woo δεν έχει προμηθευτές (η fetchWooRows("SUPPLIER") ρίχνει Error).
const WOO_KINDS: EntityKind[] = ["CUSTOMER", "PRODUCT", "PRODUCT_CATEGORY", "COLOR", "SIZE"];

const REF_COLUMN: Record<SyncSource, "softoneKey" | "wooId"> = {
  SOFTONE: "softoneKey",
  WOOCOMMERCE: "wooId",
};

const SYNC_BATCH = 50;
// Το remote MySQL είναι αργό — γενναιόδωρα timeouts στα transactions.
const TX_OPTS = { timeout: 120_000, maxWait: 15_000 };

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);
  return session;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Validation μέσω registry
// ---------------------------------------------------------------------------

type ValidateResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

function validateEntityData(kind: EntityKind, input: Record<string, unknown>): ValidateResult {
  const meta = entityMeta(kind);
  const data: Record<string, unknown> = {};

  for (const col of meta.columns) {
    const raw = input[col.key];

    if (col.kind === "boolean") {
      data[col.key] = raw === undefined || raw === null ? true : Boolean(raw);
      continue;
    }

    const str = raw === undefined || raw === null ? "" : String(raw).trim();
    if (str === "") {
      if (col.required) return { ok: false, error: `Το πεδίο «${col.headerGr}» είναι υποχρεωτικό.` };
      data[col.key] = null;
      continue;
    }

    if (col.kind === "number") {
      const n = Number(str.replace(",", "."));
      if (!Number.isFinite(n)) {
        return { ok: false, error: `Μη έγκυρος αριθμός στο πεδίο «${col.headerGr}».` };
      }
      data[col.key] = n;
    } else {
      data[col.key] = str;
    }
  }

  // Σχέσεις προϊόντος (selects στο dialog) — δεν είναι registry columns.
  if (kind === "PRODUCT") {
    for (const key of ["categoryId", "colorId", "sizeId"] as const) {
      if (key in input) {
        const raw = input[key];
        const str = raw === undefined || raw === null ? "" : String(raw).trim();
        data[key] = str === "" ? null : str;
      }
    }
  }

  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listEntities(
  kind: EntityKind,
  opts?: { search?: string; includeInactive?: boolean }
) {
  await requireAdminSession();

  const search = opts?.search?.trim();
  const where: Record<string, unknown> = {};
  if (!opts?.includeInactive) where.isActive = true;
  if (search) {
    where.OR = [{ code: { contains: search } }, { name: { contains: search } }];
  }

  const rows = await entityDelegate(kind).findMany({
    where,
    orderBy: { code: "asc" },
    take: 1000,
    ...(kind === "PRODUCT"
      ? {
          include: {
            category: { select: { name: true } },
            color: { select: { name: true } },
            size: { select: { name: true } },
          },
        }
      : {}),
  });

  return { ok: true as const, rows };
}

export async function createEntity(kind: EntityKind, data: Record<string, unknown>) {
  await requireAdminSession();

  const valid = validateEntityData(kind, data);
  if (!valid.ok) return valid;

  try {
    await entityDelegate(kind).create({ data: valid.data });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false as const, error: "Ο κωδικός υπάρχει ήδη." };
    return { ok: false as const, error: errorMessage(err) };
  }
  revalidatePath("/entities");
  return { ok: true as const };
}

export async function updateEntity(kind: EntityKind, id: string, data: Record<string, unknown>) {
  await requireAdminSession();

  const valid = validateEntityData(kind, data);
  if (!valid.ok) return valid;

  try {
    await entityDelegate(kind).update({ where: { id }, data: valid.data });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false as const, error: "Ο κωδικός υπάρχει ήδη." };
    return { ok: false as const, error: errorMessage(err) };
  }
  revalidatePath("/entities");
  return { ok: true as const };
}

export async function deleteEntity(kind: EntityKind, id: string) {
  await requireAdminSession();

  const usedCount = await prisma.processFieldValue.count({ where: { valueEntityId: id } });
  if (usedCount > 0) {
    return {
      ok: false as const,
      error: "Χρησιμοποιείται σε διαδικασίες — απενεργοποιήστε την αντί για διαγραφή.",
    };
  }

  try {
    await entityDelegate(kind).delete({ where: { id } });
  } catch (err) {
    return { ok: false as const, error: errorMessage(err) };
  }
  revalidatePath("/entities");
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Sync από connectors
// ---------------------------------------------------------------------------

/**
 * Διαθεσιμότητα sync ανά πηγή ΚΑΙ ανά kind (μόνο enabled && lastTestOk connectors).
 * SOFTONE: SUPPLIER/CUSTOMER/PRODUCT/PRODUCT_CATEGORY (χρώματα/μεγέθη εκτός v1).
 * WOOCOMMERCE: όλα ΕΚΤΟΣ SUPPLIER.
 */
export async function availableSyncSources(): Promise<{
  SOFTONE: EntityKind[];
  WOOCOMMERCE: EntityKind[];
}> {
  await requireAdminSession();

  const connectors = await prisma.connector.findMany({
    where: { type: { in: ["SOFTONE", "WOOCOMMERCE"] } },
    select: { type: true, enabled: true, lastTestOk: true },
  });

  const ready = (type: SyncSource) =>
    connectors.some((c) => c.type === type && c.enabled && c.lastTestOk === true);

  return {
    SOFTONE: ready("SOFTONE") ? SOFTONE_KINDS : [],
    WOOCOMMERCE: ready("WOOCOMMERCE") ? WOO_KINDS : [],
  };
}

/** Κρατά από τα extra ΜΟΝΟ κλειδιά που είναι πραγματικές στήλες του kind. */
function safeExtras(kind: EntityKind, extra: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!extra) return {};
  const allowed = new Set(
    entityMeta(kind)
      .columns.map((c) => c.key)
      .filter((k) => k !== "code" && k !== "name" && k !== "isActive")
  );
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

export async function syncEntities(kind: EntityKind, source: SyncSource) {
  await requireAdminSession();

  const supported = source === "SOFTONE" ? SOFTONE_KINDS : WOO_KINDS;
  if (!supported.includes(kind)) {
    return {
      ok: false as const,
      error: `Η πηγή ${source === "SOFTONE" ? "SoftOne" : "WooCommerce"} δεν υποστηρίζει συγχρονισμό για «${entityMeta(kind).labelGr}».`,
    };
  }

  // Οι fetchers ρίχνουν Greek Errors (μη ρυθμισμένος connector, HTTP σφάλματα κλπ.).
  let incoming: SyncRow[];
  try {
    incoming =
      source === "SOFTONE"
        ? await fetchSoftoneRows(kind as SoftoneSyncKind)
        : await fetchWooRows(kind);
  } catch (err) {
    return { ok: false as const, error: errorMessage(err) };
  }

  const refCol = REF_COLUMN[source];
  const delegate = entityDelegate(kind);

  const existingRaw = await delegate.findMany({
    select: { id: true, code: true, [refCol]: true },
  });
  const existing: ExistingEntity[] = existingRaw.map((e) => ({
    id: String(e.id),
    code: String(e.code),
    extId: e[refCol] == null ? null : String(e[refCol]),
  }));

  const plan = planUpserts(existing, incoming);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    // CREATE: chunked createMany με skipDuplicates — το planUpserts ταιριάζει codes
    // case-insensitively αλλά το unique του DB έχει δική του collation· τυχόν
    // «διπλά» rows απλώς μετριούνται ως skipped αντί να τινάξουν όλο το sync.
    for (const batch of chunk(plan.toCreate, SYNC_BATCH)) {
      const data = batch.map((row) => ({
        code: row.code,
        name: row.name,
        ...safeExtras(kind, row.extra),
        [refCol]: row.externalId,
        isActive: row.isActive ?? true,
      }));
      const res = await delegate.createMany({ data, skipDuplicates: true });
      created += res.count;
      skipped += batch.length - res.count;
    }

    // UPDATE: ποτέ δεν πειράζουμε τον τοπικό code· isActive μόνο αν ήρθε από την πηγή.
    for (const batch of chunk(plan.toUpdate, SYNC_BATCH)) {
      await prisma.$transaction(
        async (tx) => {
          const txDelegate = entityDelegate(kind, tx);
          for (const { id, row } of batch) {
            await txDelegate.update({
              where: { id },
              data: {
                name: row.name,
                ...safeExtras(kind, row.extra),
                [refCol]: row.externalId,
                ...(row.isActive !== undefined ? { isActive: row.isActive } : {}),
              },
            });
          }
        },
        TX_OPTS
      );
      updated += batch.length;
    }
  } catch (err) {
    return { ok: false as const, error: errorMessage(err) };
  }

  revalidatePath("/entities");
  return { ok: true as const, created, updated, skipped };
}

// ---------------------------------------------------------------------------
// Αναζήτηση για dropdowns (instance runtime — αρκεί συνεδρία, όχι ρόλος)
// ---------------------------------------------------------------------------

export async function searchEntityOptions(
  kind: EntityKind,
  query: string
): Promise<{ id: string; code: string; name: string }[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");

  const q = query.trim();
  const rows = await entityDelegate(kind).findMany({
    where: {
      isActive: true,
      ...(q ? { OR: [{ code: { contains: q } }, { name: { contains: q } }] } : {}),
    },
    orderBy: { code: "asc" },
    take: 20,
    select: { id: true, code: true, name: true },
  });

  return rows.map((r) => ({ id: String(r.id), code: String(r.code), name: String(r.name) }));
}

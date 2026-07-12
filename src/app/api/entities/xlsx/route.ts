/**
 * xlsx import/export οντοτήτων.
 * GET  ?kind=SUPPLIER → κατέβασμα template.
 * POST multipart (kind, file) → import με upsert κατά code.
 * Guard: session + SUPER_ADMIN/ADMIN (403 JSON αλλιώς).
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Prisma, Role, type EntityKind } from "@prisma/client";
import { ENTITY_KINDS, virtualColumnKeys } from "@/lib/entities/registry";
import { buildTemplateWorkbook, parseEntityWorkbook } from "@/lib/entities/xlsx";
import { entityDelegate } from "@/lib/entities/resolve";
import { detectCycles, planParentLinks, type TreeRow } from "@/lib/entities/tree";
import { prisma } from "@/lib/prisma";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || !role || !([Role.SUPER_ADMIN, Role.ADMIN] as Role[]).includes(role)) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }
  return null;
}

function parseKind(raw: string | null): EntityKind | null {
  return raw && (ENTITY_KINDS as string[]).includes(raw) ? (raw as EntityKind) : null;
}

export async function GET(request: Request) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  const kind = parseKind(new URL(request.url).searchParams.get("kind"));
  if (!kind) {
    return NextResponse.json({ error: "Μη έγκυρο είδος οντότητας" }, { status: 400 });
  }

  const buf = await buildTemplateWorkbook(kind);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="entities-${kind.toLowerCase()}.xlsx"`,
    },
  });
}

export async function POST(request: Request) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο αίτημα (αναμένεται multipart form)" }, { status: 400 });
  }

  const kind = parseKind(String(formData.get("kind") ?? "") || null);
  if (!kind) {
    return NextResponse.json({ error: "Μη έγκυρο είδος οντότητας" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Δεν βρέθηκε αρχείο" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Το αρχείο ξεπερνά τα 5MB" }, { status: 400 });
  }

  // Το parseEntityWorkbook ρίχνει Greek Errors (κακές επικεφαλίδες, χωρίς φύλλο κλπ.).
  let parsed: Awaited<ReturnType<typeof parseEntityWorkbook>>;
  try {
    parsed = await parseEntityWorkbook(kind, Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  const delegate = entityDelegate(kind);
  let created = 0;
  let updated = 0;
  const errors = [...parsed.errors];

  const virtualKeys = virtualColumnKeys(kind);
  // Γραμμές που έγιναν upsert με επιτυχία (για το pass 2 της ιεραρχίας).
  const importedCodes = new Set<string>();

  // Upsert κατά code: update name/extras/isActive αν υπάρχει, αλλιώς create.
  // Σφάλματα ανά γραμμή (π.χ. P2002 λόγω collation) μετριούνται, δεν κόβουν το import.
  // Οι εικονικές στήλες (π.χ. parentCode) δεν φτάνουν ΠΟΤΕ στο prisma write.
  for (let i = 0; i < parsed.rows.length; i++) {
    const fullRow = parsed.rows[i];
    const row = Object.fromEntries(
      Object.entries(fullRow).filter(([k]) => !virtualKeys.has(k))
    );
    const code = String(row.code);
    const { code: _code, ...rest } = row;
    try {
      const existing = await delegate.findUnique({ where: { code }, select: { id: true } });
      if (existing) {
        await delegate.update({ where: { id: String(existing.id) }, data: rest });
        updated++;
      } else {
        await delegate.create({ data: row });
        created++;
      }
      importedCodes.add(code);
    } catch (err) {
      const message =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
          ? `Ο κωδικός "${code}" υπάρχει ήδη.`
          : err instanceof Error
            ? err.message
            : String(err);
      errors.push({ rowNumber: -1, message: `Κωδικός "${code}": ${message}` });
    }
  }

  // Pass 2 (μόνο PRODUCT_CATEGORY): σύνδεση γονέων κατά «Γονικός Κωδικός».
  // Η σειρά γραμμών δεν μετράει — resolve πάνω σε (υπάρχοντα ΒΔ ∪ εισαχθέντα).
  if (kind === "PRODUCT_CATEGORY") {
    const rowNumberByCode = new Map<string, number>();
    const treeRows: TreeRow[] = [];
    for (let i = 0; i < parsed.rows.length; i++) {
      const r = parsed.rows[i];
      const code = String(r.code);
      if (!importedCodes.has(code)) continue; // η γραμμή απέτυχε στο pass 1
      rowNumberByCode.set(code, parsed.rowNumbers?.[i] ?? -1);
      treeRows.push({
        code,
        parentCode: r.parentCode == null ? null : String(r.parentCode),
      });
    }

    if (treeRows.some((r) => r.parentCode && r.parentCode.trim() !== "")) {
      const all = await prisma.productCategory.findMany({
        select: { id: true, code: true, parentId: true },
      });
      const byCode = new Map(all.map((c) => [c.code, c.id]));
      const codeById = new Map(all.map((c) => [c.id, c.code]));

      const plan = planParentLinks(treeRows, byCode);
      for (const e of plan.errors) {
        errors.push({ rowNumber: rowNumberByCode.get(e.code) ?? -1, message: `Κωδικός "${e.code}": ${e.message}` });
      }

      // Ανίχνευση κύκλων στον τελικό (θα-γίνει) χάρτη γονέων.
      const nextParent = new Map(all.map((c) => [c.id, c.parentId]));
      for (const link of plan.links) {
        const id = byCode.get(link.code);
        if (id) nextParent.set(id, link.parentId);
      }
      const cycleIds = new Set(
        detectCycles([...nextParent.entries()].map(([id, parentId]) => ({ id, parentId: parentId ?? null })))
      );

      for (const link of plan.links) {
        const id = byCode.get(link.code);
        if (id && cycleIds.has(id)) {
          errors.push({
            rowNumber: rowNumberByCode.get(link.code) ?? -1,
            message: `Κωδικός "${link.code}": η σύνδεση γονέα δημιουργεί κύκλο (${codeById.get(link.parentId) ?? link.parentId}).`,
          });
          continue;
        }
        try {
          await prisma.productCategory.updateMany({
            where: { code: link.code },
            data: { parentId: link.parentId },
          });
        } catch (err) {
          errors.push({
            rowNumber: rowNumberByCode.get(link.code) ?? -1,
            message: `Κωδικός "${link.code}": ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }
  }

  return NextResponse.json({ created, updated, errors });
}

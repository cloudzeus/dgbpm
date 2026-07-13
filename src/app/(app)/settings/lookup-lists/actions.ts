"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseLookupSheet, type LookupSheetMapping } from "@/lib/lookup-lists/excel-import";
import {
  planLookupImport,
  type LookupImportPlan,
  type ParentMatchMode,
  type PlannedItem,
} from "@/lib/lookup-lists/import-plan";
import { analyzeWorkbook } from "@/lib/entities/xlsx";
import type { WorkbookSheetInfo } from "@/lib/entities/xlsx-mapping";
import { planParentLinks, detectCycles, treeOrder } from "@/lib/entities/tree";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);
}

export type LookupColumn = { key: string; label: string };

type ItemPayload = {
  value: string;
  label: string;
  parentValue?: string | null;
  /** Τιμές extra στηλών: { [columnKey]: string } */
  extra?: Record<string, string> | null;
};

/** Κρατά μόνο τα keys των δηλωμένων στηλών, πετά κενά. */
function sanitizeExtra(
  extra: Record<string, string> | null | undefined,
  columns: LookupColumn[]
): Record<string, string> | undefined {
  if (!extra) return undefined;
  const keys = new Set(columns.map((c) => c.key));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (keys.has(k) && v.trim() !== "") out[k] = v.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeColumns(columns: LookupColumn[] | undefined | null): LookupColumn[] {
  return (columns ?? [])
    .map((c) => ({ key: c.key.trim(), label: c.label.trim() }))
    .filter((c) => c.key !== "" && c.label !== "");
}

/**
 * Πάσο 2: σύνδεση γονέων με βάση το value. Άγνωστος γονέας / self /
 * κύκλος (γονέας-απόγονος) → ελληνικό μήνυμα ανά γραμμή, οι υπόλοιπες προχωρούν.
 */
async function linkItemParents(
  tx: Prisma.TransactionClient,
  lookupListId: string,
  items: ItemPayload[]
): Promise<string[]> {
  const rows = await tx.lookupListItem.findMany({ where: { lookupListId } });
  const byValue = new Map(rows.map((r) => [r.value, r.id]));

  const { links, errors } = planParentLinks(
    items.map((it) => ({ code: it.value, parentCode: it.parentValue ?? null })),
    byValue
  );

  // Προτεινόμενος τελικός χάρτης γονέων (ανά id) → απόρριψη όσων σχηματίζουν κύκλο.
  const linkByValue = new Map(links.map((l) => [l.code, l.parentId]));
  const payloadValues = new Set(items.map((i) => i.value));
  const cycleIds = new Set(
    detectCycles(
      rows.map((r) => ({
        id: r.id,
        parentId: payloadValues.has(r.value) ? linkByValue.get(r.value) ?? null : r.parentId,
      }))
    )
  );

  const warnings = errors.map((e) => `${e.code}: ${e.message}`);

  for (const it of items) {
    const id = byValue.get(it.value);
    if (!id) continue;
    if (cycleIds.has(id)) {
      warnings.push(`${it.value}: Ο γονέας δεν μπορεί να είναι απόγονος.`);
      await tx.lookupListItem.update({ where: { id }, data: { parentId: null } });
      continue;
    }
    await tx.lookupListItem.update({ where: { id }, data: { parentId: linkByValue.get(it.value) ?? null } });
  }

  return warnings;
}

export async function createLookupList(data: {
  name: string;
  description?: string;
  valueHeader?: string | null;
  labelHeader?: string | null;
  extraColumns?: LookupColumn[];
  items: ItemPayload[];
}): Promise<{ id: string; warnings: string[] }> {
  await requireAdmin();
  const columns = sanitizeColumns(data.extraColumns);
  const result = await prisma.$transaction(async (tx) => {
    const list = await tx.lookupList.create({
      data: {
        name: data.name,
        description: data.description ?? undefined,
        valueHeader: data.valueHeader?.trim() || null,
        labelHeader: data.labelHeader?.trim() || null,
        extraColumns: columns.length > 0 ? columns : Prisma.JsonNull,
        items: {
          create: data.items.map((it, i) => ({
            value: it.value,
            label: it.label,
            order: i,
            extra: sanitizeExtra(it.extra, columns),
          })),
        },
      },
    });
    const warnings = await linkItemParents(tx, list.id, data.items);
    return { id: list.id, warnings };
  }, { timeout: 120_000, maxWait: 15_000 }); // αργή remote MySQL — αποφυγή P2028
  revalidatePath("/settings/lookup-lists");
  return result;
}

export async function updateLookupList(id: string, data: {
  name: string;
  description?: string;
  valueHeader?: string | null;
  labelHeader?: string | null;
  extraColumns?: LookupColumn[];
  items: ItemPayload[];
}): Promise<{ warnings: string[] }> {
  await requireAdmin();
  const columns = sanitizeColumns(data.extraColumns);
  const warnings = await prisma.$transaction(async (tx) => {
    await tx.lookupList.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? undefined,
        valueHeader: data.valueHeader?.trim() || null,
        labelHeader: data.labelHeader?.trim() || null,
        extraColumns: columns.length > 0 ? columns : Prisma.JsonNull,
      },
    });
    // items referenced by values must survive: delete only unreferenced, upsert by (list,value)
    const existing = await tx.lookupListItem.findMany({ where: { lookupListId: id } });
    const keepValues = new Set(data.items.map((i) => i.value));
    const removable = existing.filter((e) => !keepValues.has(e.value));
    for (const r of removable) {
      const refs = await tx.processFieldValue.count({ where: { valueListItemId: r.id } });
      if (refs === 0) await tx.lookupListItem.delete({ where: { id: r.id } });
    }
    const byValue = new Map(existing.map((e) => [e.value, e]));
    let order = 0;
    for (const it of data.items) {
      const found = byValue.get(it.value);
      const extra = sanitizeExtra(it.extra, columns) ?? Prisma.JsonNull;
      if (found)
        await tx.lookupListItem.update({ where: { id: found.id }, data: { label: it.label, order, extra } });
      else
        await tx.lookupListItem.create({ data: { lookupListId: id, value: it.value, label: it.label, order, extra } });
      order++;
    }
    return linkItemParents(tx, id, data.items);
  }, { timeout: 120_000, maxWait: 15_000 }); // αργή remote MySQL — αποφυγή P2028
  revalidatePath("/settings/lookup-lists");
  return { warnings };
}

/** Γρήγορη καταχώρηση μίας τιμής σε υπάρχουσα λίστα (από τη γραμμή του πίνακα). */
export async function addLookupListItem(
  listId: string,
  item: {
    value: string;
    label: string;
    parentValue?: string | null;
    extra?: Record<string, string> | null;
  }
): Promise<{ warnings: string[] }> {
  await requireAdmin();
  const value = item.value.trim();
  const label = item.label.trim() || value;
  if (!value) throw new Error("Απαιτείται τιμή (value).");

  const warnings = await prisma.$transaction(async (tx) => {
    const list = await tx.lookupList.findUnique({ where: { id: listId }, select: { extraColumns: true } });
    if (!list) throw new Error("Η λίστα δεν βρέθηκε.");
    const columns = sanitizeColumns((list.extraColumns as LookupColumn[] | null) ?? []);
    const existing = await tx.lookupListItem.findFirst({
      where: { lookupListId: listId, value },
      select: { id: true },
    });
    if (existing) throw new Error(`Η τιμή «${value}» υπάρχει ήδη στη λίστα.`);
    const max = await tx.lookupListItem.aggregate({
      where: { lookupListId: listId },
      _max: { order: true },
    });
    await tx.lookupListItem.create({
      data: {
        lookupListId: listId,
        value,
        label,
        order: (max._max.order ?? -1) + 1,
        extra: sanitizeExtra(item.extra, columns),
      },
    });
    const parentValue = item.parentValue?.trim() || null;
    if (!parentValue) return [] as string[];
    const parent = await tx.lookupListItem.findFirst({
      where: { lookupListId: listId, value: parentValue },
      select: { id: true },
    });
    if (!parent) return [`${value}: Ο γονέας «${parentValue}» δεν βρέθηκε.`];
    await tx.lookupListItem.updateMany({
      where: { lookupListId: listId, value },
      data: { parentId: parent.id },
    });
    return [] as string[];
  }, { timeout: 120_000, maxWait: 15_000 }); // αργή remote MySQL — αποφυγή P2028
  revalidatePath("/settings/lookup-lists");
  return { warnings };
}

/** Inline αλλαγή επικεφαλίδων στηλών από το expand του πίνακα. */
export async function updateLookupListHeaders(
  listId: string,
  data: { valueHeader?: string | null; labelHeader?: string | null }
): Promise<void> {
  await requireAdmin();
  await prisma.lookupList.update({
    where: { id: listId },
    data: {
      ...(data.valueHeader !== undefined ? { valueHeader: data.valueHeader?.trim() || null } : {}),
      ...(data.labelHeader !== undefined ? { labelHeader: data.labelHeader?.trim() || null } : {}),
    },
  });
  revalidatePath("/settings/lookup-lists");
}

/** Inline επεξεργασία τιμής από το expand του πίνακα. */
export async function updateLookupListItem(
  itemId: string,
  data: { value: string; label: string; extra?: Record<string, string> | null }
): Promise<void> {
  await requireAdmin();
  const value = data.value.trim();
  const label = data.label.trim() || value;
  if (!value) throw new Error("Απαιτείται τιμή (value).");
  const item = await prisma.lookupListItem.findUnique({
    where: { id: itemId },
    select: { lookupListId: true, lookupList: { select: { extraColumns: true } } },
  });
  if (!item) throw new Error("Η τιμή δεν βρέθηκε.");
  const dup = await prisma.lookupListItem.findFirst({
    where: { lookupListId: item.lookupListId, value, id: { not: itemId } },
    select: { id: true },
  });
  if (dup) throw new Error(`Η τιμή «${value}» υπάρχει ήδη στη λίστα.`);
  const columns = sanitizeColumns((item.lookupList.extraColumns as LookupColumn[] | null) ?? []);
  await prisma.lookupListItem.update({
    where: { id: itemId },
    data: {
      value,
      label,
      ...(data.extra !== undefined
        ? { extra: sanitizeExtra(data.extra, columns) ?? Prisma.JsonNull }
        : {}),
    },
  });
  revalidatePath("/settings/lookup-lists");
}

/** Inline διαγραφή τιμής — μπλοκάρεται αν χρησιμοποιείται σε διαδικασία. */
export async function deleteLookupListItem(itemId: string): Promise<void> {
  await requireAdmin();
  const refs = await prisma.processFieldValue.count({ where: { valueListItemId: itemId } });
  if (refs > 0)
    throw new Error("Η τιμή χρησιμοποιείται σε καταχωρήσεις διαδικασιών και δεν μπορεί να διαγραφεί.");
  await prisma.lookupListItem.delete({ where: { id: itemId } });
  revalidatePath("/settings/lookup-lists");
}

export async function deleteLookupList(id: string) {
  await requireAdmin();
  const inUse = await prisma.processFieldDefinition.count({ where: { lookupListId: id, deletedAt: null } });
  if (inUse > 0) throw new Error("Η λίστα χρησιμοποιείται σε πρότυπο και δεν μπορεί να διαγραφεί.");
  await prisma.lookupList.delete({ where: { id } });
  revalidatePath("/settings/lookup-lists");
}

/** Βήμα 1 wizard: ανάλυση αρχείου — φύλλα, επικεφαλίδες, δείγμα, πλήθος γραμμών. */
export async function analyzeLookupWorkbook(
  formData: FormData
): Promise<{ sheets: WorkbookSheetInfo[] }> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Δεν επιλέχθηκε αρχείο.");
  return analyzeWorkbook(Buffer.from(await file.arrayBuffer()));
}

/** Βήμα 3 wizard: πλήρης υπολογισμός αποτελέσματος ΧΩΡΙΣ εγγραφές. */
export async function previewLookupImport(formData: FormData): Promise<LookupImportPlan> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Δεν επιλέχθηκε αρχείο.");
  const sheetName = String(formData.get("sheetName") ?? "");
  const mapping = JSON.parse(String(formData.get("mapping") ?? "{}")) as LookupSheetMapping;
  const parentMatch = (String(formData.get("parentMatch") ?? "auto") || "auto") as ParentMatchMode;
  const createMissingParents = formData.get("createMissingParents") === "1";
  const listId = String(formData.get("listId") ?? "") || null;

  const rows = await parseLookupSheet(Buffer.from(await file.arrayBuffer()), sheetName, mapping);
  const existing = listId
    ? await prisma.lookupListItem.findMany({
        where: { lookupListId: listId },
        select: { id: true, value: true, label: true, parentId: true },
      })
    : [];
  return planLookupImport({ rows, existing, parentMatch, createMissingParents });
}

export type CommitLookupImportResult = {
  listId: string;
  created: number;
  updated: number;
  linked: number;
  unlinked: number;
  items: { value: string; label: string; parentValue: string | null }[];
};

/** Οριστική εισαγωγή: εγγράφει ΑΚΡΙΒΩΣ το προεπισκοπημένο πλάνο, σε μία συναλλαγή. */
export async function commitLookupImport(
  target: {
    listId?: string | null;
    name?: string;
    description?: string;
    /** Ονόματα στηλών του Excel — γίνονται επικεφαλίδες της λίστας. */
    valueHeader?: string | null;
    labelHeader?: string | null;
  },
  plannedItems: PlannedItem[]
): Promise<CommitLookupImportResult> {
  await requireAdmin();
  if (plannedItems.length === 0) throw new Error("Δεν υπάρχουν στοιχεία προς εισαγωγή.");

  // Σειρά γονέων πριν από παιδιά + σταθερή σειρά εμφάνισης (order).
  const byValue = new Map(plannedItems.map((p) => [p.value, p]));
  const ordered = treeOrder(
    plannedItems.map((p) => ({
      id: p.value,
      parentId: p.parentRef !== null && byValue.has(p.parentRef) ? p.parentRef : null,
    }))
  ).map((n) => byValue.get(n.id)!);

  const result = await prisma.$transaction(
    async (tx) => {
      let listId = target.listId ?? null;
      const headers = {
        valueHeader: target.valueHeader?.trim() || null,
        labelHeader: target.labelHeader?.trim() || null,
      };
      if (!listId) {
        const name = target.name?.trim();
        if (!name) throw new Error("Απαιτείται όνομα λίστας.");
        const list = await tx.lookupList.create({
          data: { name, description: target.description?.trim() || undefined, ...headers },
        });
        listId = list.id;
      } else if (headers.valueHeader || headers.labelHeader) {
        await tx.lookupList.update({ where: { id: listId }, data: headers });
      }

      const existing = await tx.lookupListItem.findMany({ where: { lookupListId: listId } });
      const idByValue = new Map(existing.map((e) => [e.value, e.id]));
      const oldParentById = new Map(existing.map((e) => [e.id, e.parentId]));

      let created = 0;
      let updated = 0;
      for (let i = 0; i < ordered.length; i++) {
        const it = ordered[i];
        const found = idByValue.get(it.value);
        if (found) {
          await tx.lookupListItem.update({ where: { id: found }, data: { label: it.label, order: i } });
          updated++;
        } else {
          const row = await tx.lookupListItem.create({
            data: { lookupListId: listId, value: it.value, label: it.label, order: i },
          });
          idByValue.set(it.value, row.id);
          created++;
        }
      }

      // Σύνδεση γονέων από το πλάνο (τα parentRef είναι values του ίδιου συνόλου).
      // Server-side κυκλο-προστασία: δεν εμπιστευόμαστε το client plan για acyclicity.
      const plannedParent = ordered.map((it) => ({
        id: idByValue.get(it.value)!,
        parentId: it.parentRef !== null ? idByValue.get(it.parentRef) ?? null : null,
      }));
      const cyclic = new Set(detectCycles(plannedParent));
      let linked = 0;
      let unlinked = 0;
      for (const it of ordered) {
        const id = idByValue.get(it.value)!;
        const parentId = cyclic.has(id)
          ? null
          : it.parentRef !== null ? idByValue.get(it.parentRef) ?? null : null;
        if ((oldParentById.get(id) ?? null) !== parentId) {
          await tx.lookupListItem.update({ where: { id }, data: { parentId } });
        }
        if (parentId !== null) linked++;
        else if (oldParentById.get(id)) unlinked++;
      }

      return {
        listId,
        created,
        updated,
        linked,
        unlinked,
        items: ordered.map((it) => ({
          value: it.value,
          label: it.label,
          parentValue: it.parentRef,
        })),
      };
    },
    { timeout: 120_000, maxWait: 15_000 }
  );

  revalidatePath("/settings/lookup-lists");
  return result;
}

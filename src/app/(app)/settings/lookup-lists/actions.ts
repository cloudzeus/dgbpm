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

type ItemPayload = { value: string; label: string; parentValue?: string | null };

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
  items: ItemPayload[];
}): Promise<{ id: string; warnings: string[] }> {
  await requireAdmin();
  const result = await prisma.$transaction(async (tx) => {
    const list = await tx.lookupList.create({
      data: {
        name: data.name,
        description: data.description ?? undefined,
        items: { create: data.items.map((it, i) => ({ value: it.value, label: it.label, order: i })) },
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
  items: ItemPayload[];
}): Promise<{ warnings: string[] }> {
  await requireAdmin();
  const warnings = await prisma.$transaction(async (tx) => {
    await tx.lookupList.update({ where: { id }, data: { name: data.name, description: data.description ?? undefined } });
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
      if (found) await tx.lookupListItem.update({ where: { id: found.id }, data: { label: it.label, order } });
      else await tx.lookupListItem.create({ data: { lookupListId: id, value: it.value, label: it.label, order } });
      order++;
    }
    return linkItemParents(tx, id, data.items);
  }, { timeout: 120_000, maxWait: 15_000 }); // αργή remote MySQL — αποφυγή P2028
  revalidatePath("/settings/lookup-lists");
  return { warnings };
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
  target: { listId?: string | null; name?: string; description?: string },
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
      if (!listId) {
        const name = target.name?.trim();
        if (!name) throw new Error("Απαιτείται όνομα λίστας.");
        const list = await tx.lookupList.create({
          data: { name, description: target.description?.trim() || undefined },
        });
        listId = list.id;
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

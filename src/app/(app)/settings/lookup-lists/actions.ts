"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseLookupItemsFromWorkbook, validateLookupHierarchy } from "@/lib/lookup-lists/excel-import";
import { planParentLinks, detectCycles } from "@/lib/entities/tree";

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
  });
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
  });
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

export async function importLookupItems(formData: FormData): Promise<{
  items: { value: string; label: string; parentValue: string | null }[];
  errors: string[];
}> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Δεν επιλέχθηκε αρχείο.");
  const buf = await file.arrayBuffer();
  const parsed = await parseLookupItemsFromWorkbook(buf);
  const hierarchyErrors = validateLookupHierarchy(parsed);
  const invalid = new Set(hierarchyErrors.map((e) => e.value));
  return {
    items: parsed.map((p) => ({
      value: p.value,
      label: p.label,
      // Άκυρος γονέας (άγνωστος/κύκλος) → εισαγωγή χωρίς γονέα, με μήνυμα.
      parentValue: invalid.has(p.value) ? null : p.parentValue,
    })),
    errors: hierarchyErrors.map((e) => `${e.value}: ${e.message}`),
  };
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseLookupItemsFromWorkbook } from "@/lib/lookup-lists/excel-import";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);
}

export async function createLookupList(data: {
  name: string;
  description?: string;
  items: { value: string; label: string }[];
}) {
  await requireAdmin();
  await prisma.lookupList.create({
    data: {
      name: data.name,
      description: data.description ?? undefined,
      items: { create: data.items.map((it, i) => ({ value: it.value, label: it.label, order: i })) },
    },
  });
  revalidatePath("/settings/lookup-lists");
}

export async function updateLookupList(id: string, data: {
  name: string;
  description?: string;
  items: { value: string; label: string }[];
}) {
  await requireAdmin();
  await prisma.$transaction(async (tx) => {
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
  });
  revalidatePath("/settings/lookup-lists");
}

export async function deleteLookupList(id: string) {
  await requireAdmin();
  const inUse = await prisma.processFieldDefinition.count({ where: { lookupListId: id, deletedAt: null } });
  if (inUse > 0) throw new Error("Η λίστα χρησιμοποιείται σε πρότυπο και δεν μπορεί να διαγραφεί.");
  await prisma.lookupList.delete({ where: { id } });
  revalidatePath("/settings/lookup-lists");
}

export async function importLookupItems(formData: FormData): Promise<{ value: string; label: string }[]> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Δεν επιλέχθηκε αρχείο.");
  const buf = await file.arrayBuffer();
  const parsed = await parseLookupItemsFromWorkbook(buf);
  return parsed.map((p) => ({ value: p.value, label: p.label }));
}

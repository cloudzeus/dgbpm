/**
 * Επίλυση ετικετών οντοτήτων (id → «code — name») + κοινός delegate helper.
 * Χρησιμοποιείται από τα instance views και από τα server actions / xlsx route.
 */
import type { EntityKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { entityMeta } from "./registry";

/**
 * Ελάχιστο κοινό interface των έξι entity delegates (supplier/customer/product/
 * productCategory/color/size) — μόνο οι μέθοδοι που χρειαζόμαστε.
 */
export type EntityDelegate = {
  findMany(args?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  createMany(args: { data: Record<string, unknown>[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  delete(args: { where: { id: string } }): Promise<unknown>;
};

/**
 * Επιστρέφει το prisma delegate του kind. Το ΜΟΝΑΔΙΚΟ cast του entities layer:
 * τα έξι μοντέλα έχουν πανομοιότυπο σχήμα (id/code/name/isActive/…) αλλά η
 * Prisma τα τυποποιεί ξεχωριστά — τα στενεύουμε στο κοινό EntityDelegate.
 */
export function entityDelegate(kind: EntityKind, client: unknown = prisma): EntityDelegate {
  const model = entityMeta(kind).prismaModel;
  return (client as Record<string, EntityDelegate>)[model];
}

const DELETED_LABEL = "(διαγραμμένο)";

/**
 * Επιλύει ετικέτες «code — name» για ζεύγη (kind, id), με batching ανά kind.
 * Το Map είναι keyed στο id· άγνωστο id → «(διαγραμμένο)».
 */
export async function resolveEntityLabels(
  pairs: { kind: EntityKind; id: string }[]
): Promise<Map<string, string>> {
  const idsByKind = new Map<EntityKind, Set<string>>();
  for (const { kind, id } of pairs) {
    if (!id) continue;
    const set = idsByKind.get(kind) ?? new Set<string>();
    set.add(id);
    idsByKind.set(kind, set);
  }

  const labels = new Map<string, string>();
  for (const { id } of pairs) {
    if (id) labels.set(id, DELETED_LABEL);
  }

  await Promise.all(
    Array.from(idsByKind.entries()).map(async ([kind, ids]) => {
      const rows = await entityDelegate(kind).findMany({
        where: { id: { in: Array.from(ids) } },
        select: { id: true, code: true, name: true },
      });
      for (const r of rows) {
        labels.set(String(r.id), `${String(r.code)} — ${String(r.name)}`);
      }
    })
  );

  return labels;
}

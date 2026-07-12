/**
 * Pure tree utilities για ιεραρχικές οντότητες (parent-child):
 * σχεδιασμός συνδέσεων γονέα από xlsx (η σειρά γραμμών ΔΕΝ μετράει),
 * ανίχνευση κύκλων, depth-first ταξινόμηση για indented rendering,
 * και σύνολο απογόνων για αποκλεισμό στο parent-picker.
 */

export type TreeRow = { code: string; parentCode?: string | null };

export type ExistingNode = { id: string; code: string; parentId: string | null };

/**
 * Για κάθε γραμμή με parentCode, βρίσκει το id του γονέα από το byCode
 * (υπάρχοντα στη ΒΔ ∪ μόλις εισαχθέντα). Άγνωστος κωδικός γονέα ή
 * self-parent → error entry (δεν κόβει τις υπόλοιπες).
 */
export function planParentLinks(
  rows: TreeRow[],
  byCode: Map<string, string /* id */>
): { links: { code: string; parentId: string }[]; errors: { code: string; message: string }[] } {
  const links: { code: string; parentId: string }[] = [];
  const errors: { code: string; message: string }[] = [];

  for (const row of rows) {
    const parentCode = row.parentCode?.trim();
    if (!parentCode) continue;

    if (parentCode === row.code) {
      errors.push({ code: row.code, message: "Ο γονικός κωδικός δεν μπορεί να είναι ο ίδιος ο κωδικός." });
      continue;
    }

    const parentId = byCode.get(parentCode);
    if (!parentId) {
      errors.push({ code: row.code, message: `Άγνωστος γονικός κωδικός "${parentCode}".` });
      continue;
    }

    links.push({ code: row.code, parentId });
  }

  return { links, errors };
}

/** Ανίχνευση κύκλων στον τελικό χάρτη γονέων· επιστρέφει τα ids που συμμετέχουν σε κύκλο. */
export function detectCycles(nodes: { id: string; parentId: string | null }[]): string[] {
  const parentOf = new Map<string, string | null>(nodes.map((n) => [n.id, n.parentId]));
  // 0 = unvisited, 1 = in progress, 2 = done
  const state = new Map<string, number>();
  const inCycle = new Set<string>();

  for (const node of nodes) {
    if (state.get(node.id)) continue;
    const path: string[] = [];
    let cur: string | null = node.id;
    while (cur !== null && parentOf.has(cur) && !state.get(cur)) {
      state.set(cur, 1);
      path.push(cur);
      cur = parentOf.get(cur) ?? null;
    }
    // Αν σταματήσαμε πάνω σε κόμβο "in progress", βρήκαμε κύκλο μέσα στο path.
    if (cur !== null && state.get(cur) === 1) {
      const start = path.indexOf(cur);
      for (const id of path.slice(start)) inCycle.add(id);
    }
    for (const id of path) state.set(id, 2);
  }

  return [...inCycle];
}

/**
 * Depth-first σειρά με depth για indented rendering. Ρίζες και ορφανά
 * (γονέας εκτός λίστας ή σε κύκλο) πρώτα, με σταθερή (input) σειρά.
 */
export function treeOrder<T extends { id: string; parentId: string | null }>(
  items: T[]
): (T & { depth: number })[] {
  const ids = new Set(items.map((i) => i.id));
  const cycleIds = new Set(detectCycles(items));
  const children = new Map<string, T[]>();
  const roots: T[] = [];

  for (const item of items) {
    const isRoot =
      item.parentId === null || !ids.has(item.parentId) || cycleIds.has(item.id);
    if (isRoot) {
      roots.push(item);
    } else {
      const list = children.get(item.parentId as string) ?? [];
      list.push(item);
      children.set(item.parentId as string, list);
    }
  }

  const out: (T & { depth: number })[] = [];
  const visit = (item: T, depth: number) => {
    out.push({ ...item, depth });
    for (const child of children.get(item.id) ?? []) visit(child, depth + 1);
  };
  for (const root of roots) visit(root, 0);

  return out;
}

/** ids του κόμβου + όλων των απογόνων του (για αποκλεισμό στο parent-picker). */
export function withDescendants(
  items: { id: string; parentId: string | null }[],
  rootId: string
): Set<string> {
  const children = new Map<string, string[]>();
  for (const item of items) {
    if (item.parentId === null) continue;
    const list = children.get(item.parentId) ?? [];
    list.push(item.id);
    children.set(item.parentId, list);
  }

  const result = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const child of children.get(cur) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  return result;
}

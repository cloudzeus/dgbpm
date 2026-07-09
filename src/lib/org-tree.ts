export type FlatDept = { id: string; parentId: string | null };

/** true if `maybeDescendantId` sits anywhere in the subtree rooted at `ancestorId`. */
export function isDescendant(
  nodes: FlatDept[],
  ancestorId: string,
  maybeDescendantId: string
): boolean {
  if (ancestorId === maybeDescendantId) return false;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let cursor = byId.get(maybeDescendantId);
  while (cursor?.parentId) {
    if (cursor.parentId === ancestorId) return true;
    cursor = byId.get(cursor.parentId);
  }
  return false;
}

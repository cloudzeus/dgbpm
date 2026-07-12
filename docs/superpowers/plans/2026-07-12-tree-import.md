# Tree (parent-child) xlsx import Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Extends the Entities feature (`docs/superpowers/specs/2026-07-12-entities-design.md`).

**Goal:** Hierarchical (parent-child) structure + xlsx import with a «Γονικός Κωδικός» column for (a) ProductCategory and (b) LookupListItem, with two-pass linking (row order must NOT matter), cycle detection, indented tree display, and parent pickers in the dialogs.

**Conventions:** same as the Entities plan (guards, Greek `{ok}` results, `prisma db push` never migrate, Msg banners, commit only intended files — user has unrelated uncommitted changes).

---

### Task A: Shared tree utilities + ProductCategory hierarchy

**Files:**
- Create: `src/lib/entities/tree.ts` + `src/lib/entities/tree.test.ts` (TDD)
- Modify: `prisma/schema.prisma` (ProductCategory self-relation)
- Modify: `src/lib/entities/registry.ts` (PRODUCT_CATEGORY gains optional xlsx column `parentCode` / «Γονικός Κωδικός»; NOT a DB column — mark it virtual so CRUD validation ignores it, e.g. a `virtual?: true` flag on EntityColumn respected by validateEntityData/rowFromRecord/recordFromRow)
- Modify: `src/app/api/entities/xlsx/route.ts` (two-pass import for PRODUCT_CATEGORY)
- Modify: `src/app/(app)/entities/actions.ts` (listEntities PRODUCT_CATEGORY returns parent relation; create/update accept parentId; reject self/descendant parent via tree util)
- Modify: `src/app/(app)/entities/entities-client.tsx` (categories tab: indented tree ordering; dialog parent Select excluding self+descendants)
- Modify: `src/lib/entities/sync-woo.ts` mapper (category `parent` id into extra) + `src/app/(app)/entities/actions.ts` syncEntities second pass linking category parents by wooId. SoftOne ITECATEGORY stays flat.

**tree.ts contract (TDD):**
```ts
export type TreeRow = { code: string; parentCode?: string | null };
export type ExistingNode = { id: string; code: string; parentId: string | null };
// Link plan: for each row with a parentCode, resolve target parent id from (existing ∪ just-imported); unknown parent code → error entry; self-parent → error.
export function planParentLinks(rows: TreeRow[], byCode: Map<string, string /*id*/>): { links: { code: string; parentId: string }[]; errors: { code: string; message: string }[] };
// Cycle detection over the would-be final parent map; returns codes participating in cycles.
export function detectCycles(nodes: { id: string; parentId: string | null }[]): string[];
// Depth-first ordering with depth for indented rendering; orphans/roots first by code; stable.
export function treeOrder<T extends { id: string; parentId: string | null }>(items: T[]): (T & { depth: number })[];
// ids of node + all descendants (for parent-picker exclusion)
export function withDescendants(items: { id: string; parentId: string | null }[], rootId: string): Set<string>;
```
Tests: link by code incl. parent defined later in file & parent pre-existing in DB; unknown parent → error; cycle A→B→A detected; treeOrder depths; withDescendants.

**Import semantics (route POST, PRODUCT_CATEGORY):** pass 1 upsert rows by code (as today, ignoring parentCode for the write); pass 2 `planParentLinks` + `detectCycles` against DB state; apply links via updateMany per parent; cycle/unknown-parent rows reported in `errors` (with rowNumber where possible) without failing the rest. Template gains the new column.

**Schema:** ProductCategory: `parentId String?` + `parent ProductCategory? @relation("ProductCategoryTree", fields: [parentId], references: [id], onDelete: SetNull)` + `children ProductCategory[] @relation("ProductCategoryTree")`. `npx prisma db push && npx prisma generate`.

Verify `npm test && npx tsc --noEmit && npm run build`. Commit intended files only.

---

### Task B: LookupListItem hierarchy

**Files:**
- Modify: `prisma/schema.prisma` (LookupListItem: `parentId String?` + self-relation "LookupItemTree", onDelete SetNull)
- Modify: `src/lib/lookup-lists/excel-import.ts` (+ its test) — READ IT FIRST; add optional «Γονικός Κωδικός» column matched against item `value`; two-pass output shape so the caller can link parents; reuse `planParentLinks`/`detectCycles` from `src/lib/entities/tree.ts`
- Modify: `src/app/(app)/settings/lookup-lists/actions.ts` — import action applies pass 2; item create/update accepts parentId with self/descendant rejection
- Modify: `src/app/(app)/settings/lookup-lists/lookup-lists-client.tsx` — indented item display via `treeOrder`; parent select in item add/edit (exclude self+descendants); template/export includes the column if an export exists
- Check SELECT field dropdowns (`dynamic-field-input.tsx` options building): keep flat but if trivial, indent option labels with `"— ".repeat(depth)`; do NOT change stored values.

Verify `npm test && npx tsc --noEmit && npm run build`. Commit intended files only (lookup-lists files are clean; verify with git diff before editing).

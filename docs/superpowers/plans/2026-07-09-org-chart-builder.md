# Οργανόγραμμα Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ένα drag-and-drop εργαλείο στο `/organization` όπου ο admin στήνει ιεραρχία τμημάτων, θέσεις εργασίας ανά τμήμα, αναθέτει χρήστες και προϊσταμένους ανά θέση.

**Architecture:** Server component (`page.tsx`) κάνει fetch όλο το δέντρο τμημάτων + χρήστες και τα περνά σε ένα client orchestrator (`organization-client.tsx`). Το UI έχει 3 ζώνες: Canvas (δέντρο τμημάτων, @dnd-kit reparent, zoom/pan/fit), Detail panel (expandable θέσεις με manager + employees), Users pool drawer (drag ανάθεση + picker fallback). Κάθε ενέργεια auto-save μέσω Next.js server actions. Καθαρή pure logic (cycle check, avatar color) απομονωμένη σε `lib/` με Vitest unit tests.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma/MySQL, @dnd-kit, shadcn/ui, Tailwind 4, Vitest (νέο, μόνο για pure logic).

**Data model:** Καμία αλλαγή στο `prisma/schema.prisma`. Χρησιμοποιεί υπάρχοντα `Department(parentId, color)`, `JobPosition(departmentId, managerId)`, `UserPosition(userId, positionId @@unique)`.

---

## File Structure

- Create `vitest.config.ts` — Vitest config (node env, `@/` alias).
- Create `src/lib/avatar.ts` — `getInitials(first,last)`, `getAvatarColor(seed)` pure helpers.
- Create `src/lib/avatar.test.ts` — unit tests.
- Create `src/lib/org-tree.ts` — `isDescendant(nodes, ancestorId, maybeDescendantId)` cycle helper + types.
- Create `src/lib/org-tree.test.ts` — unit tests.
- Create `src/app/(app)/organization/actions.ts` — server actions.
- Create `src/app/(app)/organization/page.tsx` — server component (fetch + guard).
- Create `src/app/(app)/organization/organization-client.tsx` — client orchestrator.
- Create `src/app/(app)/organization/org-avatar.tsx` — presentational avatar + stacked group.
- Create `src/app/(app)/organization/org-canvas.tsx` — canvas + DepartmentNode + zoom/pan/fit.
- Create `src/app/(app)/organization/department-detail-panel.tsx` — panel + PositionCard.
- Create `src/app/(app)/organization/user-pool-drawer.tsx` — draggable users + UserPickerDialog.
- Modify `src/lib/nav-config.ts` — add `/organization` nav item.
- Modify `package.json` — add `test` script + devDeps.

---

## Task 1: Vitest setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest@^3`
Expected: adds `vitest` to devDependencies, no errors.

- [ ] **Step 2: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Add test script**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify Vitest runs (no tests yet)**

Run: `npm test`
Expected: exits 0 with "No test files found" (acceptable) — confirms config loads.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for pure-logic unit tests"
```

---

## Task 2: Avatar pure helpers (TDD)

**Files:**
- Create: `src/lib/avatar.ts`
- Test: `src/lib/avatar.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/avatar.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getInitials, getAvatarColor } from "./avatar";

describe("getInitials", () => {
  it("takes first letter of first and last name, uppercased", () => {
    expect(getInitials("Γιώργος", "Παπαδόπουλος")).toBe("ΓΠ");
  });
  it("falls back to first two letters if last name missing", () => {
    expect(getInitials("Άννα", "")).toBe("Α");
  });
  it("returns '?' for empty input", () => {
    expect(getInitials("", "")).toBe("?");
  });
});

describe("getAvatarColor", () => {
  it("is deterministic for the same seed", () => {
    expect(getAvatarColor("user-1")).toBe(getAvatarColor("user-1"));
  });
  it("returns an hsl string", () => {
    expect(getAvatarColor("user-1")).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
  });
  it("varies across seeds", () => {
    expect(getAvatarColor("user-1")).not.toBe(getAvatarColor("user-99"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/lib/avatar.test.ts`
Expected: FAIL — "Cannot find module './avatar'".

- [ ] **Step 3: Implement helpers**

Create `src/lib/avatar.ts`:

```ts
export function getInitials(firstName: string, lastName: string): string {
  const f = firstName.trim();
  const l = lastName.trim();
  if (!f && !l) return "?";
  if (!l) return f.slice(0, 1).toUpperCase();
  return (f.slice(0, 1) + l.slice(0, 1)).toUpperCase();
}

// Deterministic, WCAG-safe (fixed saturation/lightness → white text passes AA)
export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 42%)`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/lib/avatar.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/avatar.ts src/lib/avatar.test.ts
git commit -m "feat: deterministic avatar initials + color helpers"
```

---

## Task 3: Department tree / cycle helper (TDD)

**Files:**
- Create: `src/lib/org-tree.ts`
- Test: `src/lib/org-tree.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/org-tree.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isDescendant, type FlatDept } from "./org-tree";

const nodes: FlatDept[] = [
  { id: "a", parentId: null },
  { id: "b", parentId: "a" },
  { id: "c", parentId: "b" },
  { id: "d", parentId: "a" },
];

describe("isDescendant", () => {
  it("true when target is a direct child", () => {
    expect(isDescendant(nodes, "a", "b")).toBe(true);
  });
  it("true when target is a deep descendant", () => {
    expect(isDescendant(nodes, "a", "c")).toBe(true);
  });
  it("false for a sibling", () => {
    expect(isDescendant(nodes, "b", "d")).toBe(false);
  });
  it("false when comparing a node to itself", () => {
    expect(isDescendant(nodes, "a", "a")).toBe(false);
  });
  it("false when target is an ancestor (not descendant)", () => {
    expect(isDescendant(nodes, "c", "a")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/lib/org-tree.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helper**

Create `src/lib/org-tree.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/lib/org-tree.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/org-tree.ts src/lib/org-tree.test.ts
git commit -m "feat: department subtree/cycle detection helper"
```

---

## Task 4: Server actions

**Files:**
- Create: `src/app/(app)/organization/actions.ts`

- [ ] **Step 1: Implement actions**

Create `src/app/(app)/organization/actions.ts`:

```ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { isDescendant } from "@/lib/org-tree";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

async function guard() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);
}

function revalidate() {
  revalidatePath("/organization");
  revalidatePath("/departments");
  revalidatePath("/positions");
  revalidatePath("/dashboard");
}

export async function createDepartmentNode(parentId: string | null) {
  await guard();
  await prisma.department.create({
    data: { name: "Νέο τμήμα", color: "#6366f1", parentId: parentId ?? undefined },
  });
  revalidate();
}

export async function renameDepartment(id: string, name: string) {
  await guard();
  await prisma.department.update({ where: { id }, data: { name } });
  revalidate();
}

export async function updateDepartmentMeta(
  id: string,
  data: { name?: string; email?: string | null; phoneNumber?: string | null; color?: string }
) {
  await guard();
  await prisma.department.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email ?? undefined,
      phoneNumber: data.phoneNumber ?? undefined,
      color: data.color,
    },
  });
  revalidate();
}

/** Reparent with cycle protection. newParentId=null → root. */
export async function reparentDepartment(id: string, newParentId: string | null) {
  await guard();
  if (id === newParentId) throw new Error("Ένα τμήμα δεν μπορεί να είναι γονέας του εαυτού του.");
  const all = await prisma.department.findMany({ select: { id: true, parentId: true } });
  if (newParentId && isDescendant(all, id, newParentId)) {
    throw new Error("Δεν επιτρέπεται: ο νέος γονέας ανήκει στο υποδέντρο του τμήματος.");
  }
  await prisma.department.update({ where: { id }, data: { parentId: newParentId } });
  revalidate();
}

/** Delete a department; its children are reparented to the deleted node's parent. */
export async function deleteDepartmentNode(id: string) {
  await guard();
  const dept = await prisma.department.findUnique({ where: { id }, select: { parentId: true } });
  if (!dept) return;
  await prisma.$transaction([
    prisma.department.updateMany({ where: { parentId: id }, data: { parentId: dept.parentId } }),
    prisma.department.delete({ where: { id } }),
  ]);
  revalidate();
}

export async function createPosition(departmentId: string) {
  await guard();
  await prisma.jobPosition.create({ data: { name: "Νέα θέση", departmentId } });
  revalidate();
}

export async function renamePosition(id: string, name: string) {
  await guard();
  await prisma.jobPosition.update({ where: { id }, data: { name } });
  revalidate();
}

export async function deletePosition(id: string) {
  await guard();
  await prisma.jobPosition.delete({ where: { id } });
  revalidate();
}

export async function setPositionManager(positionId: string, userId: string | null) {
  await guard();
  await prisma.jobPosition.update({ where: { id: positionId }, data: { managerId: userId } });
  revalidate();
}

export async function assignUserToPosition(positionId: string, userId: string) {
  await guard();
  await prisma.userPosition.upsert({
    where: { userId_positionId: { userId, positionId } },
    create: { userId, positionId },
    update: {},
  });
  revalidate();
}

export async function removeUserFromPosition(positionId: string, userId: string) {
  await guard();
  await prisma.userPosition.deleteMany({ where: { positionId, userId } });
  revalidate();
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `organization/actions.ts`. (Confirm `userId_positionId` matches the `@@unique([userId, positionId])` compound key name in the generated Prisma client; if the generated name differs, use the name from `node_modules/.prisma/client/index.d.ts`.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/organization/actions.ts"
git commit -m "feat: org chart server actions with reparent cycle guard"
```

---

## Task 5: Org avatar component

**Files:**
- Create: `src/app/(app)/organization/org-avatar.tsx`

- [ ] **Step 1: Implement component**

Create `src/app/(app)/organization/org-avatar.tsx`:

```tsx
"use client";

import { getInitials, getAvatarColor } from "@/lib/avatar";
import { cn } from "@/lib/utils";

export type OrgUser = { id: string; firstName: string; lastName: string; email: string };

const SIZES = { sm: "size-6 text-[10px]", md: "size-[30px] text-xs", lg: "size-10 text-sm" };

export function OrgAvatar({
  user,
  size = "md",
  className,
}: {
  user: OrgUser;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      title={`${user.firstName} ${user.lastName}`}
      style={{ backgroundColor: getAvatarColor(user.id) }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-background select-none",
        SIZES[size],
        className
      )}
    >
      {getInitials(user.firstName, user.lastName)}
    </span>
  );
}

/** Overlapping stack, capped, with +N overflow bubble. */
export function OrgAvatarStack({ users, max = 3 }: { users: OrgUser[]; max?: number }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="flex -space-x-1.5">
      {shown.map((u) => (
        <OrgAvatar key={u.id} user={u} size="sm" />
      ))}
      {extra > 0 && (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
          +{extra}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/organization/org-avatar.tsx"
git commit -m "feat: org avatar + stacked avatar group"
```

---

## Task 6: Page route + nav entry

**Files:**
- Create: `src/app/(app)/organization/page.tsx`
- Modify: `src/lib/nav-config.ts`

- [ ] **Step 1: Create the page (server component)**

Create `src/app/(app)/organization/page.tsx`:

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { OrganizationClient } from "./organization-client";

export default async function OrganizationPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  const [departments, users] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, color: true, parentId: true, email: true, phoneNumber: true,
        positions: {
          orderBy: { name: "asc" },
          select: {
            id: true, name: true, managerId: true,
            users: { select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
          },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Οργανόγραμμα</h1>
        <p className="text-muted-foreground">
          Στήσε την ιεραρχία τμημάτων, τις θέσεις εργασίας και τις αναθέσεις χρηστών.
        </p>
      </div>
      <OrganizationClient departments={departments} users={users} />
    </div>
  );
}
```

- [ ] **Step 2: Add nav entry**

In `src/lib/nav-config.ts`, after the `/departments` line (line ~28), add:

```ts
  { href: "/organization", label: "Οργανόγραμμα", icon: FiShare2, roles: ["SUPER_ADMIN", "ADMIN"] },
```

Ensure `FiShare2` is imported from `react-icons/fi` at the top of the file (add to the existing import).

- [ ] **Step 3: Temporary stub so the page compiles**

Create a minimal `src/app/(app)/organization/organization-client.tsx` stub (replaced in Task 9):

```tsx
"use client";
import type { OrgUser } from "./org-avatar";

export type DeptData = {
  id: string; name: string; color: string; parentId: string | null;
  email: string | null; phoneNumber: string | null;
  positions: { id: string; name: string; managerId: string | null; users: { user: OrgUser }[] }[];
};

export function OrganizationClient({ departments }: { departments: DeptData[]; users: OrgUser[] }) {
  return <div className="rounded-lg border p-8 text-muted-foreground">{departments.length} τμήματα</div>;
}
```

- [ ] **Step 4: Verify it renders**

Run: `npm run dev`, log in as ADMIN, open `/organization`.
Expected: page title + "N τμήματα" placeholder, nav item «Οργανόγραμμα» visible.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/organization/page.tsx" "src/app/(app)/organization/organization-client.tsx" src/lib/nav-config.ts
git commit -m "feat: /organization route + nav entry (stub client)"
```

---

## Task 7: Org canvas + department nodes (dnd reparent, zoom/pan/fit)

**Files:**
- Create: `src/app/(app)/organization/org-canvas.tsx`

- [ ] **Step 1: Implement canvas**

Create `src/app/(app)/organization/org-canvas.tsx`. Renders the full department tree top-down with connector lines, each node draggable (drag onto another node → `onReparent(dragId, dropId)`; drop on empty canvas background → `onReparent(dragId, null)`). Includes zoom −/＋ and Fit-to-screen (CSS `transform: scale()` on a wrapper) and pan (drag on background).

```tsx
"use client";

import { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrgAvatarStack, type OrgUser } from "./org-avatar";
import type { DeptData } from "./organization-client";

type TreeNode = DeptData & { children: TreeNode[] };

function buildForest(depts: DeptData[]): TreeNode[] {
  const map = new Map<string, TreeNode>(depts.map((d) => [d.id, { ...d, children: [] }]));
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function NodeBox({ dept, selected, onSelect }: { dept: DeptData; selected: boolean; onSelect: (id: string) => void }) {
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({ id: `drag:${dept.id}` });
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: `drop:${dept.id}` });
  const employees: OrgUser[] = useMemo(
    () => Array.from(new Map(dept.positions.flatMap((p) => p.users.map((u) => [u.user.id, u.user]))).values()),
    [dept.positions]
  );
  return (
    <div ref={dropRef}>
      <button
        ref={dragRef}
        {...listeners}
        {...attributes}
        onClick={() => onSelect(dept.id)}
        className={cn(
          "min-w-[150px] rounded-[10px] border border-border bg-card px-4 py-2 text-left shadow-sm transition",
          "border-l-4",
          selected && "ring-2 ring-primary",
          isOver && "ring-2 ring-primary ring-offset-2",
          isDragging && "opacity-50"
        )}
        style={{ borderLeftColor: dept.color }}
      >
        <div className="text-sm font-semibold text-foreground">{dept.name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {dept.positions.length} θέσεις
          {employees.length > 0 && <OrgAvatarStack users={employees} />}
        </div>
      </button>
    </div>
  );
}

function Subtree({ node, selectedId, onSelect }: { node: TreeNode; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col items-center">
      <NodeBox dept={node} selected={selectedId === node.id} onSelect={onSelect} />
      {node.children.length > 0 && (
        <>
          <div className="h-4 w-px bg-border" />
          <div className="flex gap-6">
            {node.children.map((c) => (
              <Subtree key={c.id} node={c} selectedId={selectedId} onSelect={onSelect} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrgCanvas({
  departments,
  selectedId,
  onSelect,
  onReparent,
}: {
  departments: DeptData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReparent: (dragId: string, dropId: string | null) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const forest = useMemo(() => buildForest(departments), [departments]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(e: DragEndEvent) {
    const dragId = String(e.active.id).replace("drag:", "");
    const over = e.over ? String(e.over.id).replace("drop:", "") : null;
    if (over && over !== dragId) onReparent(dragId, over);
  }

  return (
    <div className="relative h-full overflow-auto rounded-lg border bg-[radial-gradient(theme(colors.border)_1px,transparent_1px)] [background-size:18px_18px]">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border bg-card p-1 shadow-sm">
        <button className="rounded p-1 hover:bg-muted" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}><Minus className="size-4" /></button>
        <span className="w-10 text-center text-xs">{Math.round(zoom * 100)}%</span>
        <button className="rounded p-1 hover:bg-muted" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}><Plus className="size-4" /></button>
        <button className="rounded p-1 hover:bg-muted" onClick={() => setZoom(1)} title="Fit"><Maximize2 className="size-4" /></button>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="min-h-[400px] w-max min-w-full origin-top p-10" style={{ transform: `scale(${zoom})` }}>
          <div className="flex items-start justify-center gap-10">
            {forest.map((root) => (
              <Subtree key={root.id} node={root} selectedId={selectedId} onSelect={onSelect} />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`buildForest` returns roots; `DeptData` imported from the stub client.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/organization/org-canvas.tsx"
git commit -m "feat: org canvas with dnd reparent + zoom"
```

---

## Task 8: Detail panel + expandable position cards

**Files:**
- Create: `src/app/(app)/organization/department-detail-panel.tsx`

- [ ] **Step 1: Implement panel**

Create `src/app/(app)/organization/department-detail-panel.tsx`. Shows the selected department's positions as expandable cards. Each card: collapsed = name + stacked avatars; expanded = Manager row (with change/clear) + Employees rows (with remove) + a droppable zone (`droppableId = poszone:{positionId}`) and a `＋ επιλογή` button that opens the picker (handled in Task 9 via callbacks). All mutations are passed in as callbacks.

```tsx
"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ChevronRight, ChevronDown, X, Repeat, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrgAvatar, OrgAvatarStack, type OrgUser } from "./org-avatar";
import type { DeptData } from "./organization-client";

type Position = DeptData["positions"][number];

function PositionCard({
  position,
  usersById,
  onOpenManagerPicker,
  onClearManager,
  onOpenEmployeePicker,
  onRemoveEmployee,
  onRename,
  onDelete,
}: {
  position: Position;
  usersById: Map<string, OrgUser>;
  onOpenManagerPicker: (positionId: string) => void;
  onClearManager: (positionId: string) => void;
  onOpenEmployeePicker: (positionId: string) => void;
  onRemoveEmployee: (positionId: string, userId: string) => void;
  onRename: (positionId: string, name: string) => void;
  onDelete: (positionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: `poszone:${position.id}` });
  const employees = position.users.map((u) => u.user);
  const manager = position.managerId ? usersById.get(position.managerId) : undefined;

  return (
    <div className={cn("rounded-[9px] border", open ? "border-primary/40 bg-muted/30" : "border-border")}>
      <button className="flex w-full items-center justify-between px-3 py-2" onClick={() => setOpen((o) => !o)}>
        <span className="flex items-center gap-1 text-sm font-semibold">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          {position.name}
        </span>
        {!open && employees.length > 0 && <OrgAvatarStack users={employees} />}
      </button>

      {open && (
        <div ref={setNodeRef} className={cn("px-3 pb-3", isOver && "rounded-b-[9px] ring-2 ring-primary ring-inset")}>
          <div className="flex items-center justify-end gap-3 pb-2 text-xs text-muted-foreground">
            <button className="hover:text-foreground" onClick={() => { const n = prompt("Όνομα θέσης", position.name); if (n) onRename(position.id, n); }}>✎ μετονομασία</button>
            <button className="hover:text-destructive" onClick={() => onDelete(position.id)}><Trash2 className="size-3.5" /></button>
          </div>

          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Προϊστάμενος</div>
          {manager ? (
            <div className="mt-1 flex items-center gap-2 rounded-md border bg-card p-1.5">
              <OrgAvatar user={manager} />
              <div className="text-sm font-medium">{manager.firstName} {manager.lastName}</div>
              <div className="ml-auto flex gap-1.5 text-muted-foreground">
                <button title="Αλλαγή" onClick={() => onOpenManagerPicker(position.id)}><Repeat className="size-3.5" /></button>
                <button title="Αφαίρεση" onClick={() => onClearManager(position.id)}><X className="size-3.5" /></button>
              </div>
            </div>
          ) : (
            <button className="mt-1 w-full rounded-md border border-dashed p-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary" onClick={() => onOpenManagerPicker(position.id)}>
              ＋ Ορισμός προϊσταμένου
            </button>
          )}

          <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Υπάλληλοι · {employees.length}</div>
          {employees.map((u) => (
            <div key={u.id} className="mt-1 flex items-center gap-2 rounded-md border bg-card p-1.5">
              <OrgAvatar user={u} />
              <div className="text-sm font-medium">{u.firstName} {u.lastName}</div>
              <button className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => onRemoveEmployee(position.id, u.id)}><X className="size-3.5" /></button>
            </div>
          ))}
          <button
            className={cn("mt-2 w-full rounded-md border border-dashed p-2 text-sm text-muted-foreground hover:border-primary hover:text-primary", isOver && "border-primary bg-primary/5 text-primary")}
            onClick={() => onOpenEmployeePicker(position.id)}
          >
            ⤵ Σύρε avatar εδώ · ή ＋ επιλογή
          </button>
        </div>
      )}
    </div>
  );
}

export function DepartmentDetailPanel({
  department,
  parentName,
  usersById,
  onAddPosition,
  onRenameDepartment,
  ...cardProps
}: {
  department: DeptData | null;
  parentName: string | null;
  usersById: Map<string, OrgUser>;
  onAddPosition: (departmentId: string) => void;
  onRenameDepartment: (id: string, name: string) => void;
  onOpenManagerPicker: (positionId: string) => void;
  onClearManager: (positionId: string) => void;
  onOpenEmployeePicker: (positionId: string) => void;
  onRemoveEmployee: (positionId: string, userId: string) => void;
  onRename: (positionId: string, name: string) => void;
  onDelete: (positionId: string) => void;
}) {
  if (!department) {
    return <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">Επίλεξε ένα τμήμα από τον καμβά για να δεις τις θέσεις του.</div>;
  }
  return (
    <div className="flex h-full flex-col gap-2 overflow-auto p-4">
      <div>
        <button className="text-lg font-bold" onClick={() => { const n = prompt("Όνομα τμήματος", department.name); if (n) onRenameDepartment(department.id, n); }}>{department.name}</button>
        <div className="text-[11px] text-muted-foreground">{parentName ? `${parentName} › ` : ""}{department.name}</div>
      </div>
      {department.positions.map((p) => (
        <PositionCard key={p.id} position={p} usersById={usersById} {...cardProps} />
      ))}
      <button className="mt-1 rounded-md border border-dashed p-2 text-sm text-muted-foreground hover:border-primary hover:text-primary" onClick={() => onAddPosition(department.id)}>
        <Plus className="mr-1 inline size-4" />Νέα θέση εργασίας
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/organization/department-detail-panel.tsx"
git commit -m "feat: department detail panel with expandable position cards"
```

---

## Task 9: Users pool drawer + picker

**Files:**
- Create: `src/app/(app)/organization/user-pool-drawer.tsx`

- [ ] **Step 1: Implement drawer + picker**

Create `src/app/(app)/organization/user-pool-drawer.tsx`. Two exports: `UserPoolDrawer` (a `Sheet` with a searchable list of draggable user rows; assigned users to the currently-selected position appear dimmed) and `UserPickerDialog` (a `CommandDialog`-style searchable single-select used as fallback for both manager and employee assignment).

```tsx
"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OrgAvatar, type OrgUser } from "./org-avatar";

function DraggableUser({ user, dimmed }: { user: OrgUser; dimmed: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `user:${user.id}` });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("flex cursor-grab items-center gap-2 rounded-md border bg-card p-2", dimmed && "opacity-50", isDragging && "opacity-40")}
    >
      <OrgAvatar user={user} size="sm" />
      <span className="text-sm">{user.firstName} {user.lastName}</span>
    </div>
  );
}

export function UserPoolDrawer({
  open,
  onOpenChange,
  users,
  assignedUserIds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  users: OrgUser[];
  assignedUserIds: Set<string>;
}) {
  const [q, setQ] = useState("");
  const filtered = users.filter((u) => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-72">
        <SheetHeader><SheetTitle>Ανάθεση χρηστών</SheetTitle></SheetHeader>
        <div className="space-y-2 p-4">
          <Input placeholder="🔍 Αναζήτηση" value={q} onChange={(e) => setQ(e.target.value)} />
          <p className="text-xs text-muted-foreground">Σύρε έναν χρήστη πάνω σε μια θέση.</p>
          <div className="space-y-1.5">
            {filtered.map((u) => (
              <DraggableUser key={u.id} user={u} dimmed={assignedUserIds.has(u.id)} />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function UserPickerDialog({
  open,
  onOpenChange,
  users,
  title,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  users: OrgUser[];
  title: string;
  onPick: (userId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <DialogHeader className="px-4 pt-4"><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Command>
          <CommandInput placeholder="Αναζήτηση χρήστη…" />
          <CommandList>
            <CommandEmpty>Κανένας χρήστης.</CommandEmpty>
            {users.map((u) => (
              <CommandItem key={u.id} value={`${u.firstName} ${u.lastName} ${u.email}`} onSelect={() => { onPick(u.id); onOpenChange(false); }}>
                <OrgAvatar user={u} size="sm" />
                <span className="ml-2">{u.firstName} {u.lastName}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `CommandDialog`/`Command` subcomponent names differ, align with `src/components/ui/command.tsx` exports.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/organization/user-pool-drawer.tsx"
git commit -m "feat: user pool drawer + picker dialog"
```

---

## Task 10: Orchestrator — wire everything together

**Files:**
- Modify: `src/app/(app)/organization/organization-client.tsx` (replace the Task 6 stub)

- [ ] **Step 1: Replace stub with full orchestrator**

Replace `src/app/(app)/organization/organization-client.tsx` entirely:

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus, Users, Check, Loader2, AlertTriangle } from "lucide-react";
import type { OrgUser } from "./org-avatar";
import { OrgCanvas } from "./org-canvas";
import { DepartmentDetailPanel } from "./department-detail-panel";
import { UserPoolDrawer, UserPickerDialog } from "./user-pool-drawer";
import {
  createDepartmentNode, reparentDepartment, renameDepartment,
  createPosition, renamePosition, deletePosition,
  setPositionManager, assignUserToPosition, removeUserFromPosition,
} from "./actions";

export type DeptData = {
  id: string; name: string; color: string; parentId: string | null;
  email: string | null; phoneNumber: string | null;
  positions: { id: string; name: string; managerId: string | null; users: { user: OrgUser }[] }[];
};

type SaveState = "idle" | "saving" | "saved" | "error";
type PickerTarget = { positionId: string; mode: "manager" | "employee" } | null;

export function OrganizationClient({ departments, users }: { departments: DeptData[]; users: OrgUser[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(departments[0]?.id ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [, startTransition] = useTransition();

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const selected = departments.find((d) => d.id === selectedId) ?? null;
  const parentName = selected?.parentId ? departments.find((d) => d.id === selected.parentId)?.name ?? null : null;
  const selectedAssigned = useMemo(
    () => new Set((selected?.positions ?? []).flatMap((p) => p.users.map((u) => u.user.id))),
    [selected]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function run(fn: () => Promise<void>) {
    setSave("saving");
    startTransition(async () => {
      try { await fn(); setSave("saved"); }
      catch (e) { setSave("error"); alert(e instanceof Error ? e.message : "Σφάλμα αποθήκευσης"); }
    });
  }

  function handleDrawerDrop(e: DragEndEvent) {
    const activeId = String(e.active.id);
    if (!activeId.startsWith("user:") || !e.over) return;
    const overId = String(e.over.id);
    if (!overId.startsWith("poszone:")) return;
    const userId = activeId.replace("user:", "");
    const positionId = overId.replace("poszone:", "");
    run(() => assignUserToPosition(positionId, userId));
  }

  const cardProps = {
    usersById,
    onOpenManagerPicker: (positionId: string) => setPicker({ positionId, mode: "manager" as const }),
    onClearManager: (positionId: string) => run(() => setPositionManager(positionId, null)),
    onOpenEmployeePicker: (positionId: string) => setPicker({ positionId, mode: "employee" as const }),
    onRemoveEmployee: (positionId: string, userId: string) => run(() => removeUserFromPosition(positionId, userId)),
    onRename: (positionId: string, name: string) => run(() => renamePosition(positionId, name)),
    onDelete: (positionId: string) => run(() => deletePosition(positionId)),
  };

  return (
    <div className="rounded-lg border">
      {/* toolbar */}
      <div className="flex items-center gap-3 border-b p-2 text-sm">
        <button className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground" onClick={() => run(() => createDepartmentNode(selectedId))}>
          <Plus className="mr-1 inline size-4" />Τμήμα
        </button>
        <div className="ml-auto flex items-center gap-3">
          <button className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5" onClick={() => setDrawerOpen(true)}>
            <Users className="size-4" />Ανάθεση χρηστών
          </button>
          {save === "saving" && <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Αποθήκευση…</span>}
          {save === "saved" && <span className="flex items-center gap-1 text-green-600"><Check className="size-4" />Αποθηκεύτηκε</span>}
          {save === "error" && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="size-4" />Σφάλμα</span>}
        </div>
      </div>

      {/* body: canvas + panel; a single DndContext covers pool→poszone drops */}
      <DndContext sensors={sensors} onDragEnd={handleDrawerDrop}>
        <div className="flex h-[calc(100vh-16rem)]">
          <div className="flex-1 p-3">
            <OrgCanvas
              departments={departments}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onReparent={(dragId, dropId) => run(() => reparentDepartment(dragId, dropId))}
            />
          </div>
          <div className="w-[280px] border-l">
            <DepartmentDetailPanel
              department={selected}
              parentName={parentName}
              onAddPosition={(departmentId) => run(() => createPosition(departmentId))}
              onRenameDepartment={(id, name) => run(() => renameDepartment(id, name))}
              {...cardProps}
            />
          </div>
        </div>

        <UserPoolDrawer open={drawerOpen} onOpenChange={setDrawerOpen} users={users} assignedUserIds={selectedAssigned} />
      </DndContext>

      <UserPickerDialog
        open={picker !== null}
        onOpenChange={(o) => { if (!o) setPicker(null); }}
        users={users}
        title={picker?.mode === "manager" ? "Επιλογή προϊσταμένου" : "Ανάθεση υπαλλήλου"}
        onPick={(userId) => {
          if (!picker) return;
          if (picker.mode === "manager") run(() => setPositionManager(picker.positionId, userId));
          else run(() => assignUserToPosition(picker.positionId, userId));
        }}
      />
    </div>
  );
}
```

Note: the `OrgCanvas` reparent uses its own inner `DndContext` (Task 7) for department-node drags; this outer `DndContext` handles user→position drops. Because department drags use ids prefixed `drag:`/`drop:` and users use `user:`/`poszone:`, the two contexts don't interfere.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. The `DeptData` type here is the single source of truth — `org-canvas.tsx` and `department-detail-panel.tsx` import it from this file.

- [ ] **Step 3: Full manual verification (run the app)**

Run: `npm run dev`, log in as ADMIN, open `/organization`. Verify each flow:
1. **Create department** → click «Τμήμα» → «Νέο τμήμα» appears as child of selected; save-status shows «Αποθηκεύτηκε».
2. **Reparent** → drag a node onto another → tree updates. Drag a node onto its own descendant → alert «Δεν επιτρέπεται…», tree unchanged.
3. **Rename department** → click name in panel → prompt → updates on canvas.
4. **Add position** → «Νέα θέση εργασίας» → appears in panel.
5. **Expand position** → chevron toggles manager/employees sections.
6. **Set manager** → «Ορισμός προϊσταμένου» → picker → select → avatar appears with ⇄/×.
7. **Assign employee via drawer drag** → open «Ανάθεση χρηστών», drag a user onto an expanded position's drop-zone → avatar row appears; that user dims in the drawer.
8. **Assign employee via picker** → «＋ επιλογή» → select → appears.
9. **Remove employee / clear manager** → × removes.
10. **Zoom / Fit** → −/＋ scales; Fit resets to 100%.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors in `organization/*`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/organization/organization-client.tsx"
git commit -m "feat: wire org chart orchestrator (canvas + panel + drawer + picker)"
```

---

## Task 11: Full test + typecheck sweep

- [ ] **Step 1: Run unit tests**

Run: `npm test`
Expected: PASS (avatar + org-tree suites).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "chore: org chart build + test sweep green"
```

---

## Notes for the implementer

- **Prisma compound key name:** `assignUserToPosition` uses `userId_positionId`. If the generated client names it differently, copy the exact name from `node_modules/.prisma/client/index.d.ts`.
- **shadcn variance:** `command.tsx`, `sheet.tsx`, `dialog.tsx` exports may differ slightly from the snippets — align import names with the actual files.
- **DndContext nesting:** department reparent (inner context in `org-canvas.tsx`) and user assignment (outer context in `organization-client.tsx`) are intentionally separate; keep the id prefixes distinct.
- **Auth for manual testing:** use a SUPER_ADMIN/ADMIN account from `prisma/seed.ts`.
```

# Data Migration — Demo Data Generator (Design)

**Date:** 2026-07-12
**Status:** Approved by user

## Purpose

A super-admin-only tool that populates the system with realistic demo process
instances so dashboards and reports (/dashboard, /reports/overview, my-tasks
views) have meaningful data. It **always reuses existing real data** (company,
departments, job positions, active users, process templates, lookup lists,
connector data) and **only creates process instances** — no user actions, no
notifications, no emails.

## Access & Placement

- Page: `/settings/data-migration`
- Sidebar: entry «Data Migration» in the «Ρυθμίσεις» group of
  `src/components/app-sidebar.tsx`, visible only to `SUPER_ADMIN`.
- Route guard: server-side role check in `page.tsx` (same RBAC pattern as
  other settings pages, via `src/lib/rbac.ts`). Non-super-admins get
  redirect/404.

## Schema Change

Add `isDemo Boolean @default(false)` to:

- `ProcessInstance` — every generated instance is tagged.
- `ProcessTemplate` — only templates created by the optional AI step are
  tagged; pre-existing real templates are never modified.

Applied with `prisma db push` (project convention — no migration history).

## Wizard (4 steps, client stepper + server actions)

### Step 1 — Επισκόπηση δεδομένων (read-only)

Server component loads and displays what already exists:

- Company (name, ΑΦΜ, activities)
- Departments with managers
- Job positions
- Active users with their positions/departments
- Existing process templates (with task counts, field definitions)
- Lookup lists (with item counts)
- Connectors that are `enabled` and `lastTestOk === true`

Creates nothing. If there are **no active users** or **no departments**, the
wizard blocks continuation and links to the relevant admin pages.

### Step 2 — AI Διαδικασίες (optional)

Shown prominently only when no process templates exist; otherwise offered as
an optional "add more with AI" expander that can be skipped with one click.

Flow:

1. Admin writes a free-text description of the business.
2. Server action `proposeProcessesWithAI` calls DeepSeek (existing
   `src/lib/deepseek.ts`) with the description **plus** the real org
   structure (departments, positions). Requests strict JSON: for each
   proposed template — name, description, icon (from
   `src/lib/process-icons.tsx` set), allowed department names, and 3–7 tasks
   (name, description, order, slaDays, mandatory, approver job-position names
   chosen from the real position list, same-department/manager flags).
3. Response validated with zod; one automatic retry on invalid JSON.
4. Admin reviews proposals in an editable list (rename, remove
   processes/tasks, change approver positions), then clicks «Δημιουργία».
5. `createDemoTemplates` creates `ProcessTemplate` (with `isDemo: true`),
   `ProcessTaskTemplate`, `TaskApproverRole`, `ProcessTemplateDepartment`
   rows — same shape as the template editor produces.

### Step 3 — Παράμετροι δημιουργίας

- Date range (start / end). Validation: start < end, end ≤ today.
- Instance count, default **150**, range 1–1000.
- Completion mix slider, default ~65% completed.

### Step 4 — Δημιουργία instances

Server action `generateDemoInstances` writes rows directly — it never calls
the workflow actions, so **no emails or notifications are ever sent**.

Per instance:

- Template: random pick from all available templates (existing + AI-created).
- `startedBy`: random active user from the template's allowed departments
  (fallback: any active user).
- `startDateTime`: random within the range, weekdays only, business hours
  (09:00–17:00). `createdAt` explicitly set to match, so backdated reports
  aggregate correctly.
- Task simulation respects the sequential workflow: task N's `startedAt` =
  task N-1's `completedAt`. Duration randomized around the task's `slaDays`
  (fallback `DEFAULT_SLA_DAYS = 3`); ~20% of tasks intentionally exceed SLA
  so delay metrics in /reports/overview are populated.
- Assignees: `currentAssigneeId` picked from users holding the task's
  approver positions, honoring `approverSameDepartment` /
  `approverDepartmentManager` flags; `possibleAssignees`
  (`TaskAssignmentAssignee`) populated with the full eligible set.
- Status mix per slider: completed instances have all tasks `APPROVED` and
  `endDateTime` set; in-progress instances stop at a random step (current
  task `IN_PROGRESS`, remaining `PENDING`, no `endDateTime`). ~5% of
  instances include a `REJECTED` → resubmitted → `APPROVED` cycle.
- `TaskAction` history per task: STARTED / APPROVED / REJECTED actions with
  timestamps matching the simulation and short Greek comments from a phrase
  pool.
- **Custom field values** (`ProcessFieldValue`), one per non-deleted
  `ProcessFieldDefinition`:
  - `SELECT` → random `LookupListItem` from the linked lookup list.
  - `STRING`/`TEXT` → real customer/product names sampled read-only from
    enabled+tested connectors when available (see below), otherwise
    realistic Greek values from built-in pools (keyed heuristically on the
    field name: πελάτης/προϊόν/περιγραφή/etc.).
  - `NUMBER` → plausible random value; `DATE` → within the instance's
    timeframe; `BOOLEAN` → random; `FILE_URL` → left null.
- Writes chunked in transactions of ~25 instances; final result reports
  counts (created instances, tasks, actions, field values) and any per-chunk
  failures via toast.

### Connector sampling (`src/lib/demo-connector-sample.ts`)

Read-only, best-effort:

- SoftOne: `GetTable`-style official services for a small sample of
  customers (TRDR) and items (MTRL) via the existing connector config.
- WooCommerce: read-only products + customers list (bounded pagination).
- Any failure or missing connector → silent fallback to local Greek pools.
  Sampling never blocks generation.

### Reset — «Διαγραφή demo δεδομένων»

Button with confirmation dialog. Deletes all `isDemo` process instances
(cascade removes tasks, actions, assignees, field values), then all `isDemo`
templates (only if their remaining instances are zero). Real templates,
users, departments, lookup lists, and connector data are never touched.

## Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | `isDemo` on `ProcessInstance`, `ProcessTemplate` |
| `src/app/(app)/settings/data-migration/page.tsx` | Guard + step-1 data (server component) |
| `src/app/(app)/settings/data-migration/wizard.tsx` | Client stepper UI (shadcn/ui) |
| `src/app/(app)/settings/data-migration/actions.ts` | `proposeProcessesWithAI`, `createDemoTemplates`, `generateDemoInstances`, `deleteDemoData` |
| `src/lib/demo-seeder.ts` | Pure generation logic (dates, status mix, task simulation) — unit-testable |
| `src/lib/demo-connector-sample.ts` | Read-only connector sampling with fallback pools |
| `src/components/app-sidebar.tsx` | New Ρυθμίσεις menu entry (SUPER_ADMIN only) |

## Error Handling

- AI output: zod validation + one retry; on repeated failure show the raw
  error and let the admin retry/edit the description.
- Generation: per-chunk try/catch; partial failures reported. Because every
  row is `isDemo`-tagged, a partial run is cleanly removable via Reset.
- All server actions re-verify `SUPER_ADMIN` role.

## Testing

- Unit tests for `demo-seeder.ts`: date distribution (weekdays, range
  bounds), status mix proportions, sequential task timestamps
  (startedAt ≥ previous completedAt), SLA-exceed share, assignee eligibility.
- Manual verification: generate a small batch (e.g. 20), check /dashboard,
  /reports/overview and process-instances timeline render correctly, then
  Reset and confirm zero `isDemo` rows remain.

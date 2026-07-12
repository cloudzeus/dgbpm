# Data Migration (Demo Data Generator) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Super-admin-only wizard at `/settings/data-migration` that generates N (default 150) realistic backdated process instances from *existing* real data (users, departments, positions, templates, lookup lists, connectors), with an optional AI step to create templates when none exist, plus a "delete demo data" reset.

**Architecture:** A pure, seeded-RNG planning module (`src/lib/demo-seeder.ts`) computes everything (dates, statuses, assignees, field values) in memory; thin server actions persist the plan with chunked Prisma transactions and never call workflow actions (so no emails/notifications). AI template creation reuses the existing `generateBusinessProcesses` / `createProcessTemplatesFromBlueprints` actions, extended with an `isDemo` flag. UI is a 4-step client stepper.

**Tech Stack:** Next.js 16 App Router (server components + server actions), Prisma/MySQL (`prisma db push`), shadcn/ui, DeepSeek (existing client), vitest.

**Spec:** `docs/superpowers/specs/2026-07-12-data-migration-design.md`

**Conventions to follow (from codebase):**
- Auth guard pattern: see `src/app/(app)/settings/connectors/page.tsx` (auth() → redirect login → `requireRole([Role.SUPER_ADMIN])` → redirect /dashboard).
- Server actions return `{ ok: true, ... } | { ok: false, error: string }` (Greek error messages).
- TaskAction `action` strings used by the app: `"START"`, `"APPROVE"`, `"REJECT"`, `"UPLOAD_FILE"`. Use only `START`/`APPROVE`/`REJECT`.
- SLA fallback: `effectiveSlaDays()` from `src/lib/sla.ts` (`DEFAULT_SLA_DAYS = 3`).
- There is NO `isActive` flag on `User` — "active users" = all users. Prefer users that hold at least one position for task assignment.
- Tests: `npm test` (vitest, colocated `*.test.ts` in `src/lib`).
- Page titles use `ui-page-title` / `ui-page-subtitle` classes.

---

### Task 1: Schema — `isDemo` flags

**Files:**
- Modify: `prisma/schema.prisma` (models `ProcessTemplate` ~line 139, `ProcessInstance` ~line 247)

- [ ] **Step 1: Add fields**

In `model ProcessTemplate`, after `createdById String?` add:

```prisma
  isDemo      Boolean   @default(false)
```

In `model ProcessInstance`, after `cancelReason String? @db.Text` add:

```prisma
  isDemo             Boolean       @default(false)
```

- [ ] **Step 2: Push schema (NEVER `migrate dev` — project has no migration history)**

Run: `npx prisma db push && npx prisma generate`
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): isDemo flags on ProcessTemplate/ProcessInstance for demo data"
```

---

### Task 2: Pure seeder logic — `src/lib/demo-seeder.ts` (TDD)

**Files:**
- Create: `src/lib/demo-seeder.ts`
- Test: `src/lib/demo-seeder.test.ts`

The seeder is pure: no Prisma, no Date.now() (caller passes `now`), seeded RNG for deterministic tests.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/demo-seeder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  mulberry32,
  randomWorkDate,
  planInstances,
  type SeedTemplate,
  type SeedUser,
} from "./demo-seeder";

const START = new Date("2026-01-01T00:00:00Z");
const END = new Date("2026-06-30T00:00:00Z");
const NOW = new Date("2026-07-12T12:00:00Z");

function tmpl(over: Partial<SeedTemplate> = {}): SeedTemplate {
  return {
    id: "t1",
    name: "Έγκριση Δαπάνης",
    allowedDepartmentIds: ["d1"],
    tasks: [
      { id: "tt1", order: 0, slaDays: 2, approverPositionIds: ["p1"], approverSameDepartment: false, approverDepartmentManager: false },
      { id: "tt2", order: 1, slaDays: 3, approverPositionIds: ["p2"], approverSameDepartment: false, approverDepartmentManager: false },
    ],
    fields: [
      { id: "f1", name: "Πελάτης", type: "STRING", lookupItemIds: [] },
      { id: "f2", name: "Ποσό", type: "NUMBER", lookupItemIds: [] },
      { id: "f3", name: "Κατηγορία", type: "SELECT", lookupItemIds: ["li1", "li2"] },
    ],
    ...over,
  };
}

const USERS: SeedUser[] = [
  { id: "u1", departmentIds: ["d1"], positionIds: ["p1"] },
  { id: "u2", departmentIds: ["d1"], positionIds: ["p2"] },
  { id: "u3", departmentIds: ["d2"], positionIds: ["p1", "p2"] },
];

const PARAMS = {
  start: START,
  end: END,
  count: 40,
  completedRatio: 0.65,
  now: NOW,
  samplePools: { customers: ["ΑΦΟΙ Παπαδόπουλοι ΟΕ"], products: ["Εκτυπωτής HP"] },
};

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("randomWorkDate", () => {
  it("returns weekday dates within range, business hours", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      const d = randomWorkDate(START, END, rng);
      expect(d.getTime()).toBeGreaterThanOrEqual(START.getTime());
      expect(d.getTime()).toBeLessThanOrEqual(END.getTime());
      expect([0, 6]).not.toContain(d.getDay());
      expect(d.getHours()).toBeGreaterThanOrEqual(9);
      expect(d.getHours()).toBeLessThan(17);
    }
  });
});

describe("planInstances", () => {
  const plan = planInstances([tmpl()], USERS, { ...PARAMS, rng: mulberry32(7) });

  it("produces the requested count", () => {
    expect(plan).toHaveLength(40);
  });

  it("roughly honors the completed ratio (±15%)", () => {
    const completed = plan.filter((p) => p.status === "COMPLETED").length;
    expect(completed / plan.length).toBeGreaterThan(0.5);
    expect(completed / plan.length).toBeLessThan(0.8);
  });

  it("keeps task timestamps sequential and completed instances fully approved", () => {
    for (const p of plan) {
      let prevEnd = p.startDateTime.getTime();
      for (const t of p.tasks) {
        if (t.startedAt) expect(t.startedAt.getTime()).toBeGreaterThanOrEqual(prevEnd);
        if (t.completedAt && t.startedAt)
          expect(t.completedAt.getTime()).toBeGreaterThan(t.startedAt.getTime());
        if (t.completedAt) prevEnd = t.completedAt.getTime();
      }
      if (p.status === "COMPLETED") {
        expect(p.tasks.every((t) => t.status === "APPROVED")).toBe(true);
        expect(p.endDateTime).not.toBeNull();
      } else {
        expect(p.endDateTime).toBeNull();
        const inProg = p.tasks.filter((t) => t.status === "IN_PROGRESS");
        expect(inProg.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("assigns only users holding the task's approver positions", () => {
    for (const p of plan) {
      for (const t of p.tasks) {
        if (!t.assigneeId) continue;
        const user = USERS.find((u) => u.id === t.assigneeId)!;
        const taskTpl = tmpl().tasks.find((tt) => tt.id === t.templateTaskId)!;
        expect(user.positionIds.some((pid) => taskTpl.approverPositionIds.includes(pid))).toBe(true);
      }
    }
  });

  it("generates a field value for every field with correct kind", () => {
    for (const p of plan) {
      expect(p.fieldValues).toHaveLength(3);
      const byField = Object.fromEntries(p.fieldValues.map((v) => [v.fieldDefinitionId, v]));
      expect(typeof byField["f1"].valueString).toBe("string");
      expect(typeof byField["f2"].valueNumber).toBe("number");
      expect(["li1", "li2"]).toContain(byField["f3"].valueListItemId);
    }
  });

  it("produces some SLA-overdue completed tasks and some rejection cycles", () => {
    const overdue = plan.flatMap((p) => p.tasks).filter((t) => t.exceededSla);
    expect(overdue.length).toBeGreaterThan(0);
    const rejected = plan.flatMap((p) => p.tasks).flatMap((t) => t.actions).filter((a) => a.action === "REJECT");
    expect(rejected.length).toBeGreaterThan(0);
  });

  it("action timestamps match the task simulation", () => {
    for (const p of plan) {
      for (const t of p.tasks) {
        for (const a of t.actions) {
          if (t.startedAt) expect(a.createdAt.getTime()).toBeGreaterThanOrEqual(t.startedAt.getTime());
          if (t.completedAt) expect(a.createdAt.getTime()).toBeLessThanOrEqual(t.completedAt.getTime());
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/lib/demo-seeder.test.ts`
Expected: FAIL — cannot resolve `./demo-seeder`.

- [ ] **Step 3: Implement `src/lib/demo-seeder.ts`**

```ts
/**
 * Demo data seeder — ΚΑΘΑΡΗ λογική σχεδιασμού demo διαδικασιών (καμία I/O).
 * Ο caller (server action) κάνει τα Prisma writes. Χρησιμοποιεί seeded RNG
 * ώστε τα tests να είναι ντετερμινιστικά.
 */
import { effectiveSlaDays } from "@/lib/sla";

// ---------- Τύποι εισόδου ----------
export type SeedTemplate = {
  id: string;
  name: string;
  allowedDepartmentIds: string[];
  tasks: {
    id: string;
    order: number;
    slaDays: number | null;
    approverPositionIds: string[];
    approverSameDepartment: boolean;
    approverDepartmentManager: boolean;
  }[];
  fields: {
    id: string;
    name: string;
    type: "STRING" | "TEXT" | "NUMBER" | "DATE" | "FILE_URL" | "BOOLEAN" | "SELECT";
    lookupItemIds: string[];
  }[];
};

export type SeedUser = { id: string; departmentIds: string[]; positionIds: string[] };

export type SeedParams = {
  start: Date;
  end: Date;
  count: number;
  /** 0..1 — ποσοστό ολοκληρωμένων */
  completedRatio: number;
  now: Date;
  rng: () => number;
  samplePools: { customers: string[]; products: string[] };
};

// ---------- Τύποι εξόδου (plan) ----------
export type PlannedAction = { action: "START" | "APPROVE" | "REJECT"; message: string | null; createdAt: Date; userId: string };

export type PlannedTask = {
  templateTaskId: string;
  status: "PENDING" | "IN_PROGRESS" | "APPROVED";
  assigneeId: string | null;
  possibleAssigneeIds: string[];
  startedAt: Date | null;
  completedAt: Date | null;
  comment: string | null;
  exceededSla: boolean;
  actions: PlannedAction[];
};

export type PlannedFieldValue = {
  fieldDefinitionId: string;
  valueString: string | null;
  valueNumber: number | null;
  valueDate: Date | null;
  valueBool: boolean | null;
  valueListItemId: string | null;
};

export type PlannedInstance = {
  templateId: string;
  name: string;
  startedById: string;
  startDateTime: Date;
  endDateTime: Date | null;
  status: "RUNNING" | "COMPLETED";
  tasks: PlannedTask[];
  fieldValues: PlannedFieldValue[];
};

// ---------- RNG ----------
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

// ---------- Ημερομηνίες ----------
const MS_PER_DAY = 86_400_000;

/** Τυχαία εργάσιμη μέρα/ώρα (Δευ–Παρ, 09:00–16:59 τοπική ώρα) στο [start, end]. */
export function randomWorkDate(start: Date, end: Date, rng: () => number): Date {
  for (let i = 0; i < 50; i++) {
    const t = start.getTime() + rng() * (end.getTime() - start.getTime());
    const d = new Date(t);
    d.setHours(9 + Math.floor(rng() * 8), Math.floor(rng() * 60), Math.floor(rng() * 60), 0);
    if (d.getDay() !== 0 && d.getDay() !== 6 && d.getTime() >= start.getTime() && d.getTime() <= end.getTime()) {
      return d;
    }
  }
  // fallback: πρώτη Δευτέρα μετά το start, 10:00
  const d = new Date(start.getTime());
  while (d.getDay() === 0 || d.getDay() === 6) d.setTime(d.getTime() + MS_PER_DAY);
  d.setHours(10, 0, 0, 0);
  return d;
}

// ---------- Ελληνικά pools ----------
const COMMENT_POOL = [
  "ΟΚ, εγκρίνεται.", "Ελέγχθηκε, όλα σωστά.", "Προχωράμε στο επόμενο βήμα.",
  "Εγκρίνεται κατόπιν ελέγχου.", "Ολοκληρώθηκε κανονικά.", "Σύμφωνο με τη διαδικασία.",
];
const REJECT_POOL = [
  "Λείπουν δικαιολογητικά, παρακαλώ συμπληρώστε.", "Λάθος ποσό, χρειάζεται διόρθωση.",
  "Ελλιπή στοιχεία — επιστρέφεται για διόρθωση.",
];
const TEXT_POOL = [
  "Τυπική περίπτωση, χωρίς ιδιαιτερότητες.", "Επείγον αίτημα πελάτη.",
  "Αφορά τρέχουσα περίοδο.", "Σχετίζεται με ετήσιο πλάνο.",
];
const NAME_POOL = [
  "Μαρία Παππά", "Γιώργος Νικολάου", "Ελένη Δήμου", "Κώστας Αντωνίου", "Σοφία Ιωάννου",
];

function fieldValueFor(
  field: SeedTemplate["fields"][number],
  instStart: Date,
  instEnd: Date,
  rng: () => number,
  pools: SeedParams["samplePools"],
): PlannedFieldValue {
  const base: PlannedFieldValue = {
    fieldDefinitionId: field.id,
    valueString: null, valueNumber: null, valueDate: null, valueBool: null, valueListItemId: null,
  };
  const lname = field.name.toLowerCase();
  switch (field.type) {
    case "SELECT":
      return { ...base, valueListItemId: field.lookupItemIds.length ? pick(field.lookupItemIds, rng) : null };
    case "NUMBER":
      return { ...base, valueNumber: Math.round(rng() * 5000 * 100) / 100 };
    case "DATE":
      return { ...base, valueDate: new Date(instStart.getTime() + rng() * (instEnd.getTime() - instStart.getTime())) };
    case "BOOLEAN":
      return { ...base, valueBool: rng() < 0.5 };
    case "FILE_URL":
      return base; // κενό — δεν ανεβάζουμε αρχεία
    case "STRING":
    case "TEXT": {
      let v: string;
      if (/πελάτ|customer|προμηθευτ/.test(lname) && pools.customers.length) v = pick(pools.customers, rng);
      else if (/προϊόν|είδος|product|υλικ/.test(lname) && pools.products.length) v = pick(pools.products, rng);
      else if (/όνομα|υπάλληλ|αιτ/.test(lname)) v = pick(NAME_POOL, rng);
      else v = pick(TEXT_POOL, rng);
      return { ...base, valueString: v };
    }
  }
}

/** Χρήστες που κατέχουν κάποια από τις θέσεις εγκριτών (+ same-department κανόνας). */
function eligibleAssignees(
  task: SeedTemplate["tasks"][number],
  starter: SeedUser,
  users: SeedUser[],
): SeedUser[] {
  let eligible = users.filter((u) => u.positionIds.some((p) => task.approverPositionIds.includes(p)));
  if (task.approverSameDepartment) {
    const same = users.filter((u) => u.departmentIds.some((d) => starter.departmentIds.includes(d)));
    eligible = [...new Set([...eligible, ...same])];
  }
  if (eligible.length === 0) eligible = users; // fallback: οποιοσδήποτε
  return eligible;
}

// ---------- Κύρια συνάρτηση ----------
export function planInstances(
  templates: SeedTemplate[],
  users: SeedUser[],
  params: SeedParams,
): PlannedInstance[] {
  const { rng, samplePools } = params;
  const out: PlannedInstance[] = [];
  if (templates.length === 0 || users.length === 0) return out;

  for (let i = 0; i < params.count; i++) {
    const template = pick(templates, rng);
    const starterPool = template.allowedDepartmentIds.length
      ? users.filter((u) => u.departmentIds.some((d) => template.allowedDepartmentIds.includes(d)))
      : users;
    const starter = pick(starterPool.length ? starterPool : users, rng);

    const startDateTime = randomWorkDate(params.start, params.end, rng);
    const wantCompleted = rng() < params.completedRatio;
    const sorted = [...template.tasks].sort((a, b) => a.order - b.order);
    // Για μη-ολοκληρωμένες: μέχρι ποιο βήμα έχει φτάσει (0 = κανένα δεν ξεκίνησε πλήρως)
    const progressUpTo = wantCompleted ? sorted.length : Math.floor(rng() * sorted.length);

    let cursor = startDateTime;
    let clipped = false; // αν πέσαμε πάνω στο now, η διαδικασία μένει RUNNING
    const tasks: PlannedTask[] = [];

    for (let idx = 0; idx < sorted.length; idx++) {
      const tt = sorted[idx];
      const eligible = eligibleAssignees(tt, starter, users);
      const assignee = pick(eligible, rng);
      const possibleAssigneeIds = eligible.map((u) => u.id);
      const shouldComplete = !clipped && idx < progressUpTo;
      const isCurrent = !clipped && !shouldComplete && idx === progressUpTo && !wantCompleted;

      if (shouldComplete) {
        const sla = effectiveSlaDays(tt.slaDays);
        const exceed = rng() < 0.2; // ~20% σκόπιμα εκπρόθεσμα
        const durationDays = exceed ? sla * (1.3 + rng()) : sla * (0.2 + rng() * 0.7);
        const startedAt = new Date(cursor.getTime() + rng() * 4 * 3_600_000);
        let completedAt = new Date(startedAt.getTime() + durationDays * MS_PER_DAY);
        const actions: PlannedAction[] = [
          { action: "START", message: null, createdAt: startedAt, userId: assignee.id },
        ];
        // ~5% των βημάτων: κύκλος απόρριψης → επανέγκριση
        if (rng() < 0.05) {
          const rejectAt = new Date(startedAt.getTime() + 0.4 * (completedAt.getTime() - startedAt.getTime()));
          actions.push({ action: "REJECT", message: pick(REJECT_POOL, rng), createdAt: rejectAt, userId: assignee.id });
          completedAt = new Date(completedAt.getTime() + 1.5 * MS_PER_DAY);
        }
        if (completedAt.getTime() > params.now.getTime()) {
          // δεν προλαβαίνει να ολοκληρωθεί πριν το τώρα — μένει τρέχον βήμα
          tasks.push({
            templateTaskId: tt.id, status: "IN_PROGRESS", assigneeId: assignee.id,
            possibleAssigneeIds, startedAt, completedAt: null, comment: null,
            exceededSla: false,
            actions: [{ action: "START", message: null, createdAt: startedAt, userId: assignee.id }],
          });
          clipped = true;
          continue;
        }
        const comment = pick(COMMENT_POOL, rng);
        actions.push({ action: "APPROVE", message: comment, createdAt: completedAt, userId: assignee.id });
        tasks.push({
          templateTaskId: tt.id, status: "APPROVED", assigneeId: assignee.id,
          possibleAssigneeIds, startedAt, completedAt, comment, exceededSla: exceed, actions,
        });
        cursor = completedAt;
      } else if (isCurrent) {
        const startedAt = new Date(Math.min(cursor.getTime() + rng() * MS_PER_DAY, params.now.getTime()));
        tasks.push({
          templateTaskId: tt.id, status: "IN_PROGRESS", assigneeId: assignee.id,
          possibleAssigneeIds, startedAt, completedAt: null, comment: null, exceededSla: false,
          actions: [{ action: "START", message: null, createdAt: startedAt, userId: assignee.id }],
        });
      } else {
        tasks.push({
          templateTaskId: tt.id, status: "PENDING", assigneeId: null,
          possibleAssigneeIds, startedAt: null, completedAt: null, comment: null,
          exceededSla: false, actions: [],
        });
      }
    }

    const allApproved = tasks.every((t) => t.status === "APPROVED");
    const endDateTime = allApproved ? tasks[tasks.length - 1]?.completedAt ?? null : null;
    const lastEnd = endDateTime ?? params.now;

    out.push({
      templateId: template.id,
      name: `${template.name} #${i + 1}`,
      startedById: starter.id,
      startDateTime,
      endDateTime,
      status: allApproved ? "COMPLETED" : "RUNNING",
      tasks,
      fieldValues: template.fields.map((f) => fieldValueFor(f, startDateTime, lastEnd, rng, samplePools)),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/lib/demo-seeder.test.ts`
Expected: PASS (all tests). If ratio/overdue assertions are flaky for the chosen seed, adjust the seed number in the test (not the tolerances) until deterministic-green, since the RNG is seeded.

- [ ] **Step 5: Commit**

```bash
git add src/lib/demo-seeder.ts src/lib/demo-seeder.test.ts
git commit -m "feat(demo): pure demo-instance planner with seeded RNG (TDD)"
```

---

### Task 3: Connector sampling — `src/lib/demo-connector-sample.ts`

**Files:**
- Create: `src/lib/demo-connector-sample.ts`

Read-only, best-effort sampling of real customer/product names from enabled connectors; silent fallback to Greek pools. No unit tests (network I/O); the fallback path is exercised implicitly by the action.

- [ ] **Step 1: Implement**

```ts
/**
 * Δείγματα πραγματικών ονομάτων πελατών/προϊόντων από ενεργές διασυνδέσεις,
 * για ρεαλιστικές τιμές στα demo custom πεδία. Read-only & best-effort:
 * οποιοδήποτε σφάλμα → σιωπηλό fallback στα τοπικά pools.
 */
import { getConnectorValues } from "@/lib/connectors/read";

export type SamplePools = { customers: string[]; products: string[] };

export const FALLBACK_POOLS: SamplePools = {
  customers: [
    "ΑΦΟΙ Παπαδόπουλοι ΟΕ", "Ελληνικά Τρόφιμα ΑΕ", "TechnoServe ΕΠΕ", "Δίκτυο Λογιστικής ΙΚΕ",
    "Μεταφορική Αιγαίου ΑΕ", "Κατασκευαστική Ήλιος ΟΕ", "Φαρμακείο Νίκη", "Ξενοδοχεία Κύμα ΑΕ",
  ],
  products: [
    "Εκτυπωτής HP LaserJet", "Φορητός Η/Υ Dell Latitude", "Γραφείο εργασίας 160cm",
    "Λογισμικό ERP - ετήσια άδεια", "Οθόνη 27'' 4K", "Καρέκλα γραφείου εργονομική",
    "Πολυμηχάνημα Canon", "Server Rack 42U",
  ],
};

const LIMIT = 40;
const TIMEOUT_MS = 8000;

async function withTimeout<T>(p: Promise<T>): Promise<T> {
  return await Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT_MS)),
  ]);
}

async function sampleWoo(): Promise<Partial<SamplePools>> {
  const c = await getConnectorValues("WOOCOMMERCE");
  if (!c?.enabled || !c.config.baseUrl || !c.secrets.consumerKey || !c.secrets.consumerSecret) return {};
  const auth = Buffer.from(`${c.secrets.consumerKey}:${c.secrets.consumerSecret}`).toString("base64");
  const get = async (path: string) => {
    const res = await withTimeout(
      fetch(`${c.config.baseUrl.replace(/\/$/, "")}/wp-json/wc/v3${path}`, {
        headers: { Authorization: `Basic ${auth}` },
        cache: "no-store",
      }),
    );
    if (!res.ok) throw new Error(`woo ${res.status}`);
    return res.json();
  };
  const out: Partial<SamplePools> = {};
  try {
    const products = (await get(`/products?per_page=${LIMIT}&_fields=name`)) as { name?: string }[];
    out.products = products.map((p) => p.name).filter((n): n is string => !!n);
  } catch { /* αγνόησε */ }
  try {
    const customers = (await get(`/customers?per_page=${LIMIT}&_fields=first_name,last_name`)) as
      { first_name?: string; last_name?: string }[];
    out.customers = customers
      .map((c) => `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim())
      .filter(Boolean);
  } catch { /* αγνόησε */ }
  return out;
}

// SoftOne: παραλείπεται σκόπιμα στην v1 (απαιτεί πλήρη ροή login/authenticate/
// GetTable με win1253 αποκωδικοποίηση). Αν προστεθεί, ΜΟΝΟ επίσημα S1 services.

export async function buildSamplePools(): Promise<SamplePools> {
  const pools: SamplePools = { customers: [...FALLBACK_POOLS.customers], products: [...FALLBACK_POOLS.products] };
  try {
    const woo = await sampleWoo();
    if (woo.customers?.length) pools.customers = woo.customers;
    if (woo.products?.length) pools.products = woo.products;
  } catch { /* fallback */ }
  return pools;
}
```

Note: check the actual WooCommerce connector `config`/`secrets` field names in `src/lib/connectors/registry.ts` and use those exact keys (e.g. they may be `url`/`consumer_key` — adapt the property access accordingly).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/demo-connector-sample.ts
git commit -m "feat(demo): read-only connector sampling with Greek fallback pools"
```

---

### Task 4: `isDemo` support in template creation

**Files:**
- Modify: `src/app/(app)/process-templates/actions.ts` (`createProcessTemplate` ~line 396, `createProcessTemplatesFromBlueprints` ~line 334)

- [ ] **Step 1: Thread the flag through**

In `createProcessTemplate`'s `data` parameter type add `isDemo?: boolean;` and in the `tx.processTemplate.create` data add:

```ts
        isDemo: data.isDemo ?? false,
```

Change `createProcessTemplatesFromBlueprints` signature to:

```ts
export async function createProcessTemplatesFromBlueprints(
  blueprints: ProcessBlueprint[],
  opts: { isDemo?: boolean } = {},
): Promise<{ created: number }> {
```

and inside its `createProcessTemplate({...})` call add `isDemo: opts.isDemo ?? false,`.

- [ ] **Step 2: Typecheck + existing tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean (existing callers pass no second arg → default `{}`).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/process-templates/actions.ts"
git commit -m "feat(templates): optional isDemo flag when creating templates from blueprints"
```

---

### Task 5: Server actions — `src/app/(app)/settings/data-migration/actions.ts`

**Files:**
- Create: `src/app/(app)/settings/data-migration/actions.ts`

All actions: auth → `requireRole([Role.SUPER_ADMIN])`, Greek errors, `{ ok }` results. Persistence writes rows directly — never calls `process-instances/actions.ts` workflow functions, so no emails fire.

- [ ] **Step 1: Implement**

```ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { planInstances, mulberry32, type SeedTemplate, type SeedUser } from "@/lib/demo-seeder";
import { buildSamplePools } from "@/lib/demo-connector-sample";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);
  return session;
}

/** Δεδομένα βήματος 1 — επισκόπηση όσων υπάρχουν ήδη. */
export async function getMigrationOverview() {
  await requireSuperAdmin();
  const [company, departments, positions, users, templates, lookupLists, connectors, demoInstances, demoTemplates] =
    await Promise.all([
      prisma.company.findFirst({ include: { activities: true } }),
      prisma.department.findMany({ orderBy: { name: "asc" } }),
      prisma.jobPosition.findMany({ include: { department: { select: { name: true } } }, orderBy: { name: "asc" } }),
      prisma.user.findMany({
        include: { positions: { include: { position: { select: { name: true, departmentId: true } } } } },
        orderBy: [{ lastName: "asc" }],
      }),
      prisma.processTemplate.findMany({
        include: { _count: { select: { tasks: true, fields: true, instances: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.lookupList.findMany({ include: { _count: { select: { items: true } } } }),
      prisma.connector.findMany({ where: { enabled: true, lastTestOk: true }, select: { type: true } }),
      prisma.processInstance.count({ where: { isDemo: true } }),
      prisma.processTemplate.count({ where: { isDemo: true } }),
    ]);
  return {
    company: company ? { name: company.name, afm: company.afm } : null,
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    positions: positions.map((p) => ({ id: p.id, name: p.name, department: p.department.name })),
    users: users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      positions: u.positions.map((up) => up.position.name),
    })),
    templates: templates.map((t) => ({
      id: t.id, name: t.name, isDemo: t.isDemo,
      taskCount: t._count.tasks, fieldCount: t._count.fields, instanceCount: t._count.instances,
    })),
    lookupLists: lookupLists.map((l) => ({ id: l.id, name: l.name, itemCount: l._count.items })),
    activeConnectors: connectors.map((c) => c.type),
    demoInstanceCount: demoInstances,
    demoTemplateCount: demoTemplates,
  };
}

export type MigrationOverview = Awaited<ReturnType<typeof getMigrationOverview>>;

const CHUNK = 25;

/** Βήμα 4 — δημιουργία demo instances. ΜΟΝΟ εγγραφές ΒΔ, καμία ειδοποίηση. */
export async function generateDemoInstances(input: {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  count: number;
  completedRatio: number; // 0..1
}): Promise<
  | { ok: true; instances: number; tasks: number; actions: number; fieldValues: number }
  | { ok: false; error: string }
> {
  await requireSuperAdmin();

  const start = new Date(`${input.startDate}T00:00:00`);
  const end = new Date(`${input.endDate}T23:59:59`);
  const now = new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end)
    return { ok: false, error: "Μη έγκυρο εύρος ημερομηνιών." };
  if (end > now) return { ok: false, error: "Η ημερομηνία λήξης δεν μπορεί να είναι μελλοντική." };
  const count = Math.floor(input.count);
  if (!Number.isFinite(count) || count < 1 || count > 1000)
    return { ok: false, error: "Το πλήθος πρέπει να είναι 1 έως 1000." };
  const ratio = Math.min(1, Math.max(0, input.completedRatio));

  const [templatesRaw, usersRaw] = await Promise.all([
    prisma.processTemplate.findMany({
      include: {
        tasks: { include: { approverRoles: true }, orderBy: { order: "asc" } },
        fields: { where: { deletedAt: null }, include: { lookupList: { include: { items: true } } } },
        allowedDepartments: true,
      },
    }),
    prisma.user.findMany({
      include: { positions: { include: { position: { select: { id: true, departmentId: true } } } } },
    }),
  ]);
  if (templatesRaw.length === 0)
    return { ok: false, error: "Δεν υπάρχουν πρότυπα διαδικασιών. Δημιουργήστε πρώτα (βήμα 2)." };
  const users: SeedUser[] = usersRaw
    .filter((u) => u.positions.length > 0)
    .map((u) => ({
      id: u.id,
      departmentIds: [...new Set(u.positions.map((p) => p.position.departmentId))],
      positionIds: u.positions.map((p) => p.position.id),
    }));
  if (users.length === 0)
    return { ok: false, error: "Δεν υπάρχουν χρήστες με θέσεις εργασίας." };

  const templates: SeedTemplate[] = templatesRaw
    .filter((t) => t.tasks.length > 0)
    .map((t) => ({
      id: t.id,
      name: t.name,
      allowedDepartmentIds: t.allowedDepartments.map((a) => a.departmentId),
      tasks: t.tasks.map((tt) => ({
        id: tt.id,
        order: tt.order,
        slaDays: tt.slaDays,
        approverPositionIds: tt.approverRoles.map((r) => r.jobPositionId),
        approverSameDepartment: tt.approverSameDepartment,
        approverDepartmentManager: tt.approverDepartmentManager,
      })),
      fields: t.fields.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        lookupItemIds: f.lookupList?.items.map((i) => i.id) ?? [],
      })),
    }));
  if (templates.length === 0)
    return { ok: false, error: "Κανένα πρότυπο δεν έχει βήματα." };

  const samplePools = await buildSamplePools();
  const plan = planInstances(templates, users, {
    start, end, count, completedRatio: ratio, now,
    rng: mulberry32(now.getTime() % 2147483647),
    samplePools,
  });

  let instances = 0, tasks = 0, actions = 0, fieldValues = 0;
  for (let i = 0; i < plan.length; i += CHUNK) {
    const chunk = plan.slice(i, i + CHUNK);
    await prisma.$transaction(async (tx) => {
      for (const p of chunk) {
        const inst = await tx.processInstance.create({
          data: {
            name: p.name,
            processTemplateId: p.templateId,
            startedById: p.startedById,
            startDateTime: p.startDateTime,
            endDateTime: p.endDateTime,
            status: p.status,
            isDemo: true,
            createdAt: p.startDateTime,
          },
        });
        instances++;
        for (const t of p.tasks) {
          const ta = await tx.processTaskAssignment.create({
            data: {
              processInstanceId: inst.id,
              templateTaskId: t.templateTaskId,
              status: t.status,
              currentAssigneeId: t.assigneeId,
              startedAt: t.startedAt,
              completedAt: t.completedAt,
              comment: t.comment,
              createdAt: p.startDateTime,
              possibleAssignees: {
                create: t.possibleAssigneeIds.map((userId) => ({ userId })),
              },
            },
          });
          tasks++;
          if (t.actions.length) {
            await tx.taskAction.createMany({
              data: t.actions.map((a) => ({
                taskId: ta.id, userId: a.userId, action: a.action, message: a.message, createdAt: a.createdAt,
              })),
            });
            actions += t.actions.length;
          }
        }
        const fv = p.fieldValues.filter(
          (v) => v.valueString ?? v.valueNumber ?? v.valueDate ?? v.valueBool ?? v.valueListItemId,
        );
        if (fv.length) {
          await tx.processFieldValue.createMany({
            data: fv.map((v) => ({ processInstanceId: inst.id, ...v })),
          });
          fieldValues += fv.length;
        }
      }
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/process-instances");
  revalidatePath("/reports/overview");
  return { ok: true, instances, tasks, actions, fieldValues };
}

/** Reset — διαγραφή ΟΛΩΝ των demo δεδομένων. */
export async function deleteDemoData(): Promise<
  { ok: true; instances: number; templates: number } | { ok: false; error: string }
> {
  await requireSuperAdmin();
  const { count: instances } = await prisma.processInstance.deleteMany({ where: { isDemo: true } });
  // Πρότυπα isDemo χωρίς εναπομείναντα instances (πραγματικά πρότυπα δεν αγγίζονται ποτέ)
  const { count: templates } = await prisma.processTemplate.deleteMany({
    where: { isDemo: true, instances: { none: {} } },
  });
  revalidatePath("/dashboard");
  revalidatePath("/process-instances");
  revalidatePath("/process-templates");
  revalidatePath("/reports/overview");
  return { ok: true, instances, templates };
}
```

Note: the AI step reuses `generateBusinessProcesses` and `createProcessTemplatesFromBlueprints(blueprints, { isDemo: true })` imported directly from `@/app/(app)/process-templates/actions` in the wizard — no new AI actions here.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/settings/data-migration/actions.ts"
git commit -m "feat(data-migration): server actions for overview, generation and demo reset"
```

---

### Task 6: Page + wizard UI

**Files:**
- Create: `src/app/(app)/settings/data-migration/page.tsx`
- Create: `src/app/(app)/settings/data-migration/wizard.tsx`
- Modify: `src/lib/nav-config.ts:55` (settingsNavItems)
- Modify: `src/lib/breadcrumb-config.ts` (add route label, follow existing entries' pattern)

- [ ] **Step 1: Sidebar entry**

In `src/lib/nav-config.ts`, add `FiDatabase` to the `react-icons/fi` import and append to `settingsNavItems`:

```ts
  { href: "/settings/data-migration", label: "Data Migration", icon: FiDatabase, roles: ["SUPER_ADMIN"] },
```

(`app-sidebar.tsx` renders `settingsNavItems` automatically — no change needed there.)

Add the breadcrumb label for `/settings/data-migration` → `"Data Migration"` in `src/lib/breadcrumb-config.ts`, matching how `/settings/connectors` is declared there.

- [ ] **Step 2: Server page**

`src/app/(app)/settings/data-migration/page.tsx`:

```tsx
import { auth } from "@/auth";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getMigrationOverview } from "./actions";
import { DataMigrationWizard } from "./wizard";

export default async function DataMigrationPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  try {
    requireRole(session.user.role, [Role.SUPER_ADMIN]);
  } catch {
    redirect("/dashboard");
  }

  const overview = await getMigrationOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ui-page-title">Data Migration</h1>
        <p className="ui-page-subtitle">
          Δημιουργία ρεαλιστικών demo διαδικασιών από τα υπάρχοντα δεδομένα (χρήστες, τμήματα,
          πρότυπα, λίστες, διασυνδέσεις) για να γεμίσουν οι πίνακες ελέγχου και οι αναφορές.
          Δεν αποστέλλονται ειδοποιήσεις και τα demo δεδομένα διαγράφονται με ένα κλικ.
        </p>
      </div>
      <DataMigrationWizard overview={overview} />
    </div>
  );
}
```

- [ ] **Step 3: Client wizard**

`src/app/(app)/settings/data-migration/wizard.tsx` — client component. Use existing shadcn/ui components (check `src/components/ui/` for available ones — Card, Button, Input, Slider, Badge, AlertDialog, Textarea, Checkbox are expected; if Slider is missing use a number Input). Structure:

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner"; // ή ο υπάρχων toast μηχανισμός του project — δες πώς το κάνει το connectors-client.tsx
import type { MigrationOverview } from "./actions";
import { generateDemoInstances, deleteDemoData } from "./actions";
import {
  generateBusinessProcesses,
  createProcessTemplatesFromBlueprints,
  type ProcessBlueprint,
} from "@/app/(app)/process-templates/actions";
// ... shadcn imports (Card, Button, Input, Textarea, Checkbox, Badge, AlertDialog)

type Step = 1 | 2 | 3 | 4;

export function DataMigrationWizard({ overview }: { overview: MigrationOverview }) {
  const [step, setStep] = useState<Step>(1);
  const [pending, startTransition] = useTransition();

  // Βήμα 2 state
  const [description, setDescription] = useState("");
  const [proposals, setProposals] = useState<ProcessBlueprint[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Βήμα 3 state
  const today = new Date().toISOString().slice(0, 10);
  const sixMonthsAgo = new Date(Date.now() - 182 * 86_400_000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(sixMonthsAgo);
  const [endDate, setEndDate] = useState(today);
  const [count, setCount] = useState(150);
  const [completedPct, setCompletedPct] = useState(65);

  // Βήμα 4 state
  const [result, setResult] = useState<null | { instances: number; tasks: number; actions: number; fieldValues: number }>(null);

  const blocked = overview.users.length === 0 || overview.departments.length === 0;
  const hasTemplates = overview.templates.length > 0;

  // ... handlers:
  // handlePropose(): startTransition(async () => { const r = await generateBusinessProcesses({ description });
  //   if (r.ok) { setProposals(r.processes); setSelected(new Set(r.processes.map((_, i) => i))); }
  //   else toast.error(r.error); })
  // handleCreateTemplates(): createProcessTemplatesFromBlueprints(proposals.filter((_, i) => selected.has(i)), { isDemo: true })
  //   → toast.success(`Δημιουργήθηκαν ${r.created} πρότυπα`) → setStep(3)
  // handleGenerate(): const r = await generateDemoInstances({ startDate, endDate, count, completedRatio: completedPct / 100 });
  //   if (r.ok) { setResult(r); toast.success(...) } else toast.error(r.error)
  // handleReset(): AlertDialog confirmation → deleteDemoData() → toast + router.refresh()

  return (/* stepper: 4 Cards, ένα ορατό ανά βήμα, κουμπιά Πίσω/Επόμενο */);
}
```

Concrete UI requirements per step (implement fully, not as comments):

- **Stepper header:** 4 numbered chips («1. Επισκόπηση», «2. AI Διαδικασίες», «3. Παράμετροι», «4. Δημιουργία»), the active one highlighted.
- **Step 1:** summary cards with counts (τμήματα, θέσεις, χρήστες, πρότυπα, λίστες, ενεργές διασυνδέσεις — render `activeConnectors` as Badges) and compact tables (users with their positions; templates with task/field/instance counts, `isDemo` badge). If `blocked`, show a destructive Alert «Απαιτούνται χρήστες με θέσεις και τμήματα» with links to `/users`, `/departments` and disable «Επόμενο». If `overview.demoInstanceCount > 0`, show existing demo count + the «Διαγραφή demo δεδομένων» button (AlertDialog: «Θα διαγραφούν X demo διαδικασίες. Τα πραγματικά δεδομένα δεν επηρεάζονται.»).
- **Step 2:** if `hasTemplates`, headline «Υπάρχουν ήδη N πρότυπα — μπορείτε να συνεχίσετε» + prominent «Παράλειψη» button, with the AI form collapsed under «Δημιουργία επιπλέον με AI». Otherwise show the form directly: Textarea for business description, «Πρόταση διαδικασιών (AI)» button (loading state while pending). Proposals render as checkbox list with name, description and task count; «Δημιουργία επιλεγμένων» calls `createProcessTemplatesFromBlueprints(..., { isDemo: true })`.
- **Step 3:** two `<Input type="date">` (Έναρξη/Λήξη), number Input for πλήθος (min 1, max 1000, default 150), number Input or Slider for % ολοκληρωμένων (default 65). Client-side validation mirrors the server rules; «Επόμενο» disabled when invalid.
- **Step 4:** summary of chosen parameters, big «Δημιουργία N διαδικασιών» button with pending spinner («Δημιουργία σε εξέλιξη…»). On success render a results Card (πλήθος διαδικασιών/βημάτων/ενεργειών/τιμών πεδίων) with links to `/dashboard` and `/reports/overview`, plus the reset button.

- [ ] **Step 4: Verify UI compiles and renders**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -20`
Expected: build succeeds. (If `sonner` isn't the project's toast — check `src/app/(app)/settings/connectors/connectors-client.tsx` and copy its exact toast import.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/settings/data-migration/" src/lib/nav-config.ts src/lib/breadcrumb-config.ts
git commit -m "feat(data-migration): super-admin wizard UI + sidebar entry"
```

---

### Task 7: End-to-end verification

**Files:** none (manual verification)

- [ ] **Step 1: Run the app and exercise the flow**

Run: `npm run dev`
As a SUPER_ADMIN: open `/settings/data-migration` (verify sidebar entry appears in Ρυθμίσεις; verify an ADMIN user does NOT see it and gets redirected). Walk the wizard: step 1 shows real counts; step 2 skip (or AI-generate if no templates); step 3 pick last 3 months, count **20**, 65%; step 4 generate.

- [ ] **Step 2: Verify data quality**

- `/process-instances`: ~20 new instances, mixed ΟΛΟΚΛΗΡΩΜΕΝΗ/ΣΕ ΕΞΕΛΙΞΗ, timeline modal shows sequential steps with Greek comments and backdated timestamps.
- `/dashboard` and `/reports/overview`: charts populated; SLA/καθυστερήσεις section non-empty.
- DB spot-check: `npx prisma studio` → all new `ProcessInstance` rows have `isDemo = true`; no emails were sent (nothing in Mailgun report `/reports/mailgun`).

- [ ] **Step 3: Verify reset**

Click «Διαγραφή demo δεδομένων» → confirm → verify `/process-instances` back to previous state and `prisma.processInstance.count({ where: { isDemo: true } })` is 0. Real templates/users untouched.

- [ ] **Step 4: Full test suite + final commit**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

```bash
git add -A docs/superpowers/plans/
git commit -m "docs: data-migration implementation plan"
```

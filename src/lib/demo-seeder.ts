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
    type: "STRING" | "TEXT" | "NUMBER" | "DATE" | "FILE_URL" | "BOOLEAN" | "SELECT" | "ENTITY";
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
    case "ENTITY":
      return base; // handled in entities feature
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

/**
 * Χρήστες που κατέχουν κάποια από τις θέσεις εγκριτών (+ same-department κανόνας).
 *
 * ΣΗΜΕΙΩΣΗ — σκόπιμη χαλάρωση για demo δεδομένα: το fallback «όλοι οι χρήστες»
 * εγγυάται ότι κάθε βήμα μπορεί να προσομοιωθεί (το πραγματικό workflow θα
 * άφηνε τα possibleAssignees κενά). Επίσης το `approverDepartmentManager`
 * αγνοείται σκόπιμα, γιατί ο SeedUser δεν μεταφέρει πληροφορία manager.
 */
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
        let exceed = rng() < 0.2; // ~20% σκόπιμα εκπρόθεσμα
        const durationDays = exceed ? sla * (1.3 + rng()) : sla * (0.2 + rng() * 0.7);
        // clamp στο now: αν το βήμα clipαριστεί σε IN_PROGRESS, το startedAt δεν επιτρέπεται να είναι μελλοντικό
        const startedAt = new Date(Math.min(cursor.getTime() + rng() * 4 * 3_600_000, params.now.getTime()));
        let completedAt = new Date(startedAt.getTime() + durationDays * MS_PER_DAY);
        const actions: PlannedAction[] = [
          { action: "START", message: null, createdAt: startedAt, userId: assignee.id },
        ];
        // ~5% των βημάτων: κύκλος απόρριψης → επανέγκριση
        if (rng() < 0.05) {
          const rejectAt = new Date(startedAt.getTime() + 0.4 * (completedAt.getTime() - startedAt.getTime()));
          actions.push({ action: "REJECT", message: pick(REJECT_POOL, rng), createdAt: rejectAt, userId: assignee.id });
          completedAt = new Date(completedAt.getTime() + 1.5 * MS_PER_DAY);
          // η καθυστέρηση του κύκλου απόρριψης μπορεί να ξεπεράσει το SLA — επανυπολογισμός
          exceed = completedAt.getTime() - startedAt.getTime() > sla * MS_PER_DAY;
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

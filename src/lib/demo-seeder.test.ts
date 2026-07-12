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

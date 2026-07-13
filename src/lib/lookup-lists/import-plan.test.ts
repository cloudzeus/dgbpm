import { describe, it, expect } from "vitest";
import { planLookupImport, suggestLookupMapping } from "./import-plan";

const noExisting: { id: string; value: string; label: string; parentId: string | null }[] = [];

describe("planLookupImport — parent matching", () => {
  it("matches parent by value against imported rows", () => {
    const plan = planLookupImport({
      rows: [
        { value: "R", label: "Ρίζα", parent: null },
        { value: "C", label: "Παιδί", parent: "R" },
      ],
      existing: noExisting,
      parentMatch: "auto",
      createMissingParents: false,
    });
    const child = plan.items.find((i) => i.value === "C")!;
    expect(child.parentRef).toBe("R");
    expect(child.isNew).toBe(true);
    expect(plan.unresolved).toEqual([]);
    expect(plan.stats).toMatchObject({ total: 2, created: 2, updated: 0, roots: 1, depth: 2 });
  });

  it("matches parent by value against existing items and marks matched rows as updates", () => {
    const plan = planLookupImport({
      rows: [{ value: "C", label: "Παιδί", parent: "10" }],
      existing: [{ id: "x1", value: "10", label: "Ρίζα", parentId: null }],
      parentMatch: "value",
      createMissingParents: false,
    });
    expect(plan.items.find((i) => i.value === "C")!.parentRef).toBe("10");
    // existing item present in the final tree, not new
    const root = plan.items.find((i) => i.value === "10")!;
    expect(root.isNew).toBe(false);
    expect(plan.stats.created).toBe(1);
  });

  it("auto mode falls back to label match, case/accent-insensitive", () => {
    const plan = planLookupImport({
      rows: [{ value: "20", label: "Πουκάμισα", parent: "ΑΝΔΡΙΚΆ ρουχα" }],
      existing: [{ id: "x1", value: "10", label: "Ανδρικά Ρούχα", parentId: null }],
      parentMatch: "auto",
      createMissingParents: false,
    });
    expect(plan.items.find((i) => i.value === "20")!.parentRef).toBe("10");
    expect(plan.unresolved).toEqual([]);
  });

  it("matches by slugified label as last resort", () => {
    const plan = planLookupImport({
      rows: [{ value: "20", label: "Παιδί", parent: "ανδρικα-ρουχα" }],
      existing: [{ id: "x1", value: "10", label: "Ανδρικά Ρούχα", parentId: null }],
      parentMatch: "auto",
      createMissingParents: false,
    });
    expect(plan.items.find((i) => i.value === "20")!.parentRef).toBe("10");
  });

  it("parentMatch=value does NOT match by label", () => {
    const plan = planLookupImport({
      rows: [{ value: "20", label: "Παιδί", parent: "Ανδρικά Ρούχα" }],
      existing: [{ id: "x1", value: "10", label: "Ανδρικά Ρούχα", parentId: null }],
      parentMatch: "value",
      createMissingParents: false,
    });
    expect(plan.items.find((i) => i.value === "20")!.parentRef).toBeNull();
    expect(plan.unresolved).toEqual([{ name: "Ανδρικά Ρούχα", count: 1 }]);
  });

  it("treats dashes and empty as no parent", () => {
    const plan = planLookupImport({
      rows: [
        { value: "A", label: "A", parent: "—" },
        { value: "B", label: "B", parent: "-" },
        { value: "C", label: "C", parent: "–" },
        { value: "D", label: "D", parent: "" },
        { value: "E", label: "E", parent: null },
      ],
      existing: noExisting,
      parentMatch: "auto",
      createMissingParents: false,
    });
    expect(plan.items.every((i) => i.parentRef === null)).toBe(true);
    expect(plan.unresolved).toEqual([]);
    expect(plan.stats.roots).toBe(5);
  });
});

describe("planLookupImport — unresolved parents", () => {
  it("groups missing parents by distinct name with counts", () => {
    const plan = planLookupImport({
      rows: [
        { value: "1", label: "Α", parent: "ΑΓΝΩΣΤΟ" },
        { value: "2", label: "Β", parent: "ΑΓΝΩΣΤΟ" },
        { value: "3", label: "Γ", parent: "ΑΛΛΟ" },
      ],
      existing: noExisting,
      parentMatch: "auto",
      createMissingParents: false,
    });
    expect(plan.unresolved).toEqual([
      { name: "ΑΓΝΩΣΤΟ", count: 2 },
      { name: "ΑΛΛΟ", count: 1 },
    ]);
    expect(plan.items.every((i) => i.parentRef === null)).toBe(true);
  });

  it("createMissingParents generates root items and links children", () => {
    const plan = planLookupImport({
      rows: [
        { value: "1", label: "Α", parent: "Ανδρικά Ρούχα" },
        { value: "2", label: "Β", parent: "Ανδρικά Ρούχα" },
      ],
      existing: noExisting,
      parentMatch: "auto",
      createMissingParents: true,
    });
    const gen = plan.items.find((i) => i.label === "Ανδρικά Ρούχα");
    expect(gen).toBeTruthy();
    expect(gen!.isNew).toBe(true);
    expect(gen!.parentRef).toBeNull();
    expect(plan.items.find((i) => i.value === "1")!.parentRef).toBe(gen!.value);
    expect(plan.items.find((i) => i.value === "2")!.parentRef).toBe(gen!.value);
    // still reported so the UI can show what was auto-created
    expect(plan.unresolved).toEqual([{ name: "Ανδρικά Ρούχα", count: 2 }]);
    expect(plan.stats.depth).toBe(2);
  });

  it("generated parent value avoids collisions with existing values", () => {
    const plan = planLookupImport({
      rows: [{ value: "1", label: "Α", parent: "Shoes!" }],
      existing: [{ id: "x", value: "shoes", label: "Άλλο", parentId: null }],
      parentMatch: "value",
      createMissingParents: true,
    });
    const gen = plan.items.find((i) => i.label === "Shoes!")!;
    expect(gen.value).not.toBe("shoes");
    expect(plan.items.find((i) => i.value === "1")!.parentRef).toBe(gen.value);
  });
});

describe("planLookupImport — cycles & duplicates", () => {
  it("unlinks cycle members and reports them", () => {
    const plan = planLookupImport({
      rows: [
        { value: "A", label: "A", parent: "B" },
        { value: "B", label: "B", parent: "A" },
        { value: "S", label: "S", parent: "S" },
      ],
      existing: noExisting,
      parentMatch: "value",
      createMissingParents: false,
    });
    expect([...plan.cycles].sort()).toEqual(["A", "B", "S"]);
    expect(plan.items.every((i) => i.parentRef === null)).toBe(true);
  });

  it("collapses duplicate values in the file (last label wins)", () => {
    const plan = planLookupImport({
      rows: [
        { value: "X", label: "Πρώτο", parent: null },
        { value: "X", label: "Δεύτερο", parent: null },
      ],
      existing: noExisting,
      parentMatch: "auto",
      createMissingParents: false,
    });
    expect(plan.items.filter((i) => i.value === "X")).toHaveLength(1);
    expect(plan.items[0].label).toBe("Δεύτερο");
    expect(plan.stats.total).toBe(2);
    expect(plan.stats.created).toBe(1);
  });
});

describe("suggestLookupMapping", () => {
  it("suggests value/label/parent from Greek headers", () => {
    expect(suggestLookupMapping(["Κωδικός", "Όνομα", "Γονική Κατηγορία"])).toEqual({
      value: "Κωδικός",
      label: "Όνομα",
      parent: "Γονική Κατηγορία",
    });
  });
  it("falls back label=value column when only one usable column", () => {
    expect(suggestLookupMapping(["Τιμή"])).toEqual({ value: "Τιμή", label: "Τιμή" });
  });
});

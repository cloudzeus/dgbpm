import { describe, expect, it } from "vitest";
import { planParentLinks, detectCycles, treeOrder, withDescendants, type TreeRow } from "./tree";

describe("planParentLinks", () => {
  const byCode = new Map<string, string>([
    ["A", "id-a"],
    ["B", "id-b"],
    ["C", "id-c"],
  ]);

  it("links a row to a parent defined later in the file", () => {
    const rows: TreeRow[] = [
      { code: "B", parentCode: "A" }, // A imported later — order must not matter
      { code: "A" },
    ];
    const { links, errors } = planParentLinks(rows, byCode);
    expect(errors).toEqual([]);
    expect(links).toEqual([{ code: "B", parentId: "id-a" }]);
  });

  it("links to a parent that pre-exists in the DB (not in the rows)", () => {
    const rows: TreeRow[] = [{ code: "C", parentCode: "A" }];
    const { links, errors } = planParentLinks(rows, byCode);
    expect(errors).toEqual([]);
    expect(links).toEqual([{ code: "C", parentId: "id-a" }]);
  });

  it("reports unknown parent code as an error", () => {
    const rows: TreeRow[] = [{ code: "A", parentCode: "MISSING" }];
    const { links, errors } = planParentLinks(rows, byCode);
    expect(links).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("A");
    expect(errors[0].message).toContain("MISSING");
  });

  it("rejects self-parent", () => {
    const rows: TreeRow[] = [{ code: "A", parentCode: "A" }];
    const { links, errors } = planParentLinks(rows, byCode);
    expect(links).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("A");
  });

  it("ignores rows without parentCode (null/undefined/empty)", () => {
    const rows: TreeRow[] = [{ code: "A" }, { code: "B", parentCode: null }, { code: "C", parentCode: "  " }];
    const { links, errors } = planParentLinks(rows, byCode);
    expect(links).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe("detectCycles", () => {
  it("detects a two-node cycle A→B→A", () => {
    const nodes = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
      { id: "c", parentId: null },
    ];
    expect(detectCycles(nodes).sort()).toEqual(["a", "b"]);
  });

  it("returns empty for a valid tree", () => {
    const nodes = [
      { id: "root", parentId: null },
      { id: "child", parentId: "root" },
      { id: "grand", parentId: "child" },
    ];
    expect(detectCycles(nodes)).toEqual([]);
  });

  it("detects a self-loop", () => {
    expect(detectCycles([{ id: "x", parentId: "x" }])).toEqual(["x"]);
  });
});

describe("treeOrder", () => {
  it("orders depth-first with depth annotations", () => {
    const items = [
      { id: "a", parentId: null },
      { id: "a1", parentId: "a" },
      { id: "a1x", parentId: "a1" },
      { id: "b", parentId: null },
      { id: "b1", parentId: "b" },
    ];
    const out = treeOrder(items);
    expect(out.map((i) => i.id)).toEqual(["a", "a1", "a1x", "b", "b1"]);
    expect(out.map((i) => i.depth)).toEqual([0, 1, 2, 0, 1]);
  });

  it("treats orphans (parent not in list) as roots and is stable", () => {
    const items = [
      { id: "orphan", parentId: "ghost" },
      { id: "root", parentId: null },
    ];
    const out = treeOrder(items);
    expect(out.map((i) => i.id)).toEqual(["orphan", "root"]);
    expect(out.every((i) => i.depth === 0)).toBe(true);
  });

  it("does not loop forever on cycles", () => {
    const items = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];
    const out = treeOrder(items);
    expect(out).toHaveLength(2);
  });
});

describe("withDescendants", () => {
  const items = [
    { id: "a", parentId: null },
    { id: "b", parentId: "a" },
    { id: "c", parentId: "b" },
    { id: "d", parentId: null },
  ];

  it("returns node + all descendants", () => {
    expect([...withDescendants(items, "a")].sort()).toEqual(["a", "b", "c"]);
  });

  it("returns just the node for a leaf", () => {
    expect([...withDescendants(items, "d")]).toEqual(["d"]);
  });
});

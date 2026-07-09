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

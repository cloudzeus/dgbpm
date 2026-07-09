import { describe, it, expect } from "vitest";
import { sanitizeIdentifier, buildPivotViewSql } from "./pivot-view";

describe("pivot-view", () => {
  it("sanitizes identifiers to safe snake_case", () => {
    expect(sanitizeIdentifier("Ποσό δαπάνης!")).toMatch(/^[a-z0-9_]+$/);
    expect(sanitizeIdentifier("")).toBe("col");
  });
  it("builds a CREATE OR REPLACE VIEW with one column per field", () => {
    const sql = buildPivotViewSql("tmpl123", [
      { id: "f1", key: "amount", type: "NUMBER" },
      { id: "f2", key: "store", type: "SELECT" },
    ]);
    expect(sql).toContain("CREATE OR REPLACE VIEW");
    expect(sql).toContain("process_data_tmpl123");
    expect(sql).toContain("MAX(CASE WHEN fv.fieldDefinitionId = 'f1'");
    expect(sql).toContain("`amount`");
    expect(sql).toContain("`store`");
  });
});

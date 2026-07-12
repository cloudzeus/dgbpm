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
  it("uses valueEntityId for ENTITY fields", () => {
    const sql = buildPivotViewSql("tmpl123", [{ id: "f1", key: "supplier", type: "ENTITY" }]);
    expect(sql).toContain("fv.valueEntityId");
    expect(sql).toContain("`supplier`");
  });
  it("throws on a templateId containing a quote/semicolon", () => {
    expect(() =>
      buildPivotViewSql("tmpl'; DROP VIEW x; --", [{ id: "f1", key: "amount", type: "NUMBER" }])
    ).toThrow("Invalid template id");
  });
  it("throws when two fields sanitize to the same column alias", () => {
    expect(() =>
      buildPivotViewSql("tmpl123", [
        { id: "f1", key: "Ποσό δαπάνης!", type: "NUMBER" },
        { id: "f2", key: "Ποσό δαπάνης?", type: "NUMBER" },
      ])
    ).toThrow(/Duplicate sanitized column alias/);
  });
});

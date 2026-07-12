import { describe, it, expect } from "vitest";
import { coerceFieldValue } from "./coerce";

describe("coerceFieldValue", () => {
  it("coerces a number", () => {
    expect(coerceFieldValue("NUMBER", "12.5", false)).toEqual({ ok: true, columns: { valueNumber: 12.5 } });
  });
  it("rejects a non-number", () => {
    expect(coerceFieldValue("NUMBER", "abc", false).ok).toBe(false);
  });
  it("coerces a date to Date", () => {
    const r = coerceFieldValue("DATE", "2026-07-09", false);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.columns.valueDate?.toISOString().slice(0, 10)).toBe("2026-07-09");
  });
  it("coerces boolean", () => {
    expect(coerceFieldValue("BOOLEAN", "true", false)).toEqual({ ok: true, columns: { valueBool: true } });
  });
  it("stores SELECT as list item id", () => {
    expect(coerceFieldValue("SELECT", "item_1", false)).toEqual({ ok: true, columns: { valueListItemId: "item_1" } });
  });
  it("stores ENTITY as entity id", () => {
    expect(coerceFieldValue("ENTITY", "ent_1", false)).toEqual({ ok: true, columns: { valueEntityId: "ent_1" } });
  });
  it("empty ENTITY optional yields null column", () => {
    expect(coerceFieldValue("ENTITY", "", false)).toEqual({ ok: true, columns: { valueEntityId: null } });
  });
  it("empty ENTITY required fails", () => {
    expect(coerceFieldValue("ENTITY", "", true).ok).toBe(false);
  });
  it("stores string types verbatim", () => {
    expect(coerceFieldValue("FILE_URL", "https://x/y.pdf", false)).toEqual({ ok: true, columns: { valueString: "https://x/y.pdf" } });
  });
  it("empty required fails", () => {
    expect(coerceFieldValue("STRING", "", true).ok).toBe(false);
  });
  it("empty optional yields null columns", () => {
    expect(coerceFieldValue("STRING", "", false)).toEqual({ ok: true, columns: { valueString: null } });
  });
});

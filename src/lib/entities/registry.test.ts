import { describe, it, expect } from "vitest";
import { ENTITY_KINDS, entityMeta, xlsxHeadersFor, rowFromRecord, recordFromRow } from "./registry";

describe("entities registry", () => {
  it("covers all seven kinds with Greek labels and code+name columns", () => {
    expect(ENTITY_KINDS).toHaveLength(7);
    for (const kind of ENTITY_KINDS) {
      const m = entityMeta(kind);
      expect(m.labelGr.length).toBeGreaterThan(0);
      expect(m.columns[0].key).toBe("code");
      expect(m.columns[1].key).toBe("name");
    }
  });

  it("xlsx headers start with Κωδικός*, Όνομα*", () => {
    for (const kind of ENTITY_KINDS) {
      const h = xlsxHeadersFor(kind);
      expect(h[0]).toBe("Κωδικός*");
      expect(h[1]).toBe("Όνομα*");
    }
  });

  it("round-trips a supplier record through xlsx row", () => {
    const rec = { code: "S001", name: "ΑΦΟΙ Α ΟΕ", afm: "123456789", address: "Οδός 1",
      city: "Αθήνα", zip: "11111", phone: "2101234567", email: "a@a.gr", isActive: true };
    const row = rowFromRecord("SUPPLIER", rec);
    const back = recordFromRow("SUPPLIER", row);
    expect(back).toMatchObject(rec);
  });

  it("recordFromRow rejects missing code/name", () => {
    expect(() => recordFromRow("COLOR", ["", "Κόκκινο"])).toThrow();
    expect(() => recordFromRow("COLOR", ["C01", ""])).toThrow();
  });
});

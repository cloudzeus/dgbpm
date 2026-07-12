import { describe, it, expect } from "vitest";
import { buildPivotRows } from "./pivot";

const fields = [
  { id: "f1", name: "Ποσό", type: "NUMBER" as const },
  { id: "f2", name: "Κατάστημα", type: "SELECT" as const },
  { id: "f3", name: "Προμηθευτής", type: "ENTITY" as const },
];

const instances = [
  {
    id: "i1", name: "Δαπάνη #1",
    fieldValues: [
      { fieldDefinitionId: "f1", valueNumber: 100, valueString: null, valueDate: null, valueBool: null, valueEntityId: null, listItem: null },
      { fieldDefinitionId: "f2", valueNumber: null, valueString: null, valueDate: null, valueBool: null, valueEntityId: null, listItem: { label: "Αθήνα" } },
      { fieldDefinitionId: "f3", valueNumber: null, valueString: null, valueDate: null, valueBool: null, valueEntityId: "ent_1", listItem: null },
    ],
  },
];

describe("buildPivotRows", () => {
  it("returns one cell per field with display values", () => {
    const rows = buildPivotRows(fields, instances);
    expect(rows[0].instanceName).toBe("Δαπάνη #1");
    expect(rows[0].cells.f1).toBe("100");
    expect(rows[0].cells.f2).toBe("Αθήνα");
    expect(rows[0].cells.f3).toBe("ent_1");
  });
  it("empty cell for missing value", () => {
    const rows = buildPivotRows(fields, [{ id: "i2", name: "Κενή", fieldValues: [] }]);
    expect(rows[0].cells.f1).toBe("");
  });
});

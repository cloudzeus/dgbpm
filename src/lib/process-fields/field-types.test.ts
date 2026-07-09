import { describe, it, expect } from "vitest";
import { FIELD_TYPES, fieldTypeLabel, valueColumnFor } from "./field-types";

describe("field-types", () => {
  it("lists all 7 types with Greek labels", () => {
    expect(FIELD_TYPES).toHaveLength(7);
    expect(fieldTypeLabel("NUMBER")).toBe("Αριθμός");
    expect(fieldTypeLabel("SELECT")).toBe("Λίστα τιμών");
  });
  it("maps each type to its storage column", () => {
    expect(valueColumnFor("NUMBER")).toBe("valueNumber");
    expect(valueColumnFor("DATE")).toBe("valueDate");
    expect(valueColumnFor("BOOLEAN")).toBe("valueBool");
    expect(valueColumnFor("SELECT")).toBe("valueListItemId");
    expect(valueColumnFor("STRING")).toBe("valueString");
    expect(valueColumnFor("TEXT")).toBe("valueString");
    expect(valueColumnFor("FILE_URL")).toBe("valueString");
  });
});

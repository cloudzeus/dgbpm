import { describe, it, expect } from "vitest";
import { ENTITY_KIND_LABELS, FIELD_TYPES, fieldTypeLabel, valueColumnFor } from "./field-types";

describe("field-types", () => {
  it("lists all 8 types with Greek labels", () => {
    expect(FIELD_TYPES).toHaveLength(8);
    expect(fieldTypeLabel("NUMBER")).toBe("Αριθμός");
    expect(fieldTypeLabel("SELECT")).toBe("Λίστα τιμών");
    expect(fieldTypeLabel("ENTITY")).toBe("Οντότητα");
  });
  it("maps each type to its storage column", () => {
    expect(valueColumnFor("NUMBER")).toBe("valueNumber");
    expect(valueColumnFor("DATE")).toBe("valueDate");
    expect(valueColumnFor("BOOLEAN")).toBe("valueBool");
    expect(valueColumnFor("SELECT")).toBe("valueListItemId");
    expect(valueColumnFor("ENTITY")).toBe("valueEntityId");
    expect(valueColumnFor("STRING")).toBe("valueString");
    expect(valueColumnFor("TEXT")).toBe("valueString");
    expect(valueColumnFor("FILE_URL")).toBe("valueString");
  });
  it("has Greek labels for all entity kinds", () => {
    expect(ENTITY_KIND_LABELS.SUPPLIER).toBe("Προμηθευτής");
    expect(ENTITY_KIND_LABELS.CUSTOMER).toBe("Πελάτης");
    expect(ENTITY_KIND_LABELS.PRODUCT).toBe("Προϊόν");
    expect(ENTITY_KIND_LABELS.PRODUCT_CATEGORY).toBe("Κατηγορία προϊόντος");
    expect(ENTITY_KIND_LABELS.COLOR).toBe("Χρώμα");
    expect(ENTITY_KIND_LABELS.SIZE).toBe("Μέγεθος");
  });
});

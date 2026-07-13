import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseLookupItemsFromWorkbook, parseLookupSheet, validateLookupHierarchy } from "./excel-import";

async function makeBuffer(
  rows: string[][],
  header: string[] = ["value", "label"]
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(header);
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

describe("parseLookupItemsFromWorkbook", () => {
  it("parses value/label rows, skipping the header and blanks", async () => {
    const buf = await makeBuffer([["ATH", "Αθήνα"], ["THE", "Θεσσαλονίκη"], ["", ""]]);
    const items = await parseLookupItemsFromWorkbook(buf);
    expect(items).toEqual([
      { value: "ATH", label: "Αθήνα", order: 0, parentValue: null },
      { value: "THE", label: "Θεσσαλονίκη", order: 1, parentValue: null },
    ]);
  });
  it("falls back label=value when only one column", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    ws.addRow(["value"]); ws.addRow(["SOLO"]);
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const items = await parseLookupItemsFromWorkbook(buf);
    expect(items).toEqual([{ value: "SOLO", label: "SOLO", order: 0, parentValue: null }]);
  });

  it("reads «Γονικός Κωδικός» column, including parents defined later in the file", async () => {
    const buf = await makeBuffer(
      [
        ["CHILD", "Παιδί", "ROOT"],
        ["ROOT", "Ρίζα", ""],
      ],
      ["value", "label", "Γονικός Κωδικός"]
    );
    const items = await parseLookupItemsFromWorkbook(buf);
    expect(items).toEqual([
      { value: "CHILD", label: "Παιδί", order: 0, parentValue: "ROOT" },
      { value: "ROOT", label: "Ρίζα", order: 1, parentValue: null },
    ]);
    expect(validateLookupHierarchy(items)).toEqual([]);
  });

  it("keeps parentValue null when the column is absent", async () => {
    const buf = await makeBuffer([["ATH", "Αθήνα"]]);
    const items = await parseLookupItemsFromWorkbook(buf);
    expect(items).toEqual([{ value: "ATH", label: "Αθήνα", order: 0, parentValue: null }]);
  });
});

describe("parseLookupSheet", () => {
  it("parses with explicit column mapping in any column order", async () => {
    const buf = await makeBuffer(
      [["Αθήνα", "ΑΤΤΙΚΗ", "ATH"], ["", "", ""]],
      ["Όνομα", "Γονέας", "Κωδικός"]
    );
    const rows = await parseLookupSheet(Buffer.from(buf), "Sheet1", {
      value: "Κωδικός",
      label: "Όνομα",
      parent: "Γονέας",
    });
    expect(rows).toEqual([{ value: "ATH", label: "Αθήνα", parent: "ΑΤΤΙΚΗ" }]);
  });

  it("label falls back to value when label maps to the same column or is omitted", async () => {
    const buf = await makeBuffer([["SOLO"]], ["Τιμή"]);
    const rows = await parseLookupSheet(Buffer.from(buf), "Sheet1", { value: "Τιμή", label: "Τιμή" });
    expect(rows).toEqual([{ value: "SOLO", label: "SOLO", parent: null }]);
  });

  it("throws Greek error for missing mapped column", async () => {
    const buf = await makeBuffer([["A"]], ["Τιμή"]);
    await expect(
      parseLookupSheet(Buffer.from(buf), "Sheet1", { value: "Λάθος" })
    ).rejects.toThrow(/Λάθος/);
  });
});

describe("validateLookupHierarchy", () => {
  it("reports unknown parent codes in Greek", () => {
    const errors = validateLookupHierarchy([
      { value: "A", label: "A", order: 0, parentValue: "MISSING" },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].value).toBe("A");
    expect(errors[0].message).toContain("Άγνωστος γονικός κωδικός");
  });

  it("rejects cycles (including self-parenting)", () => {
    const errors = validateLookupHierarchy([
      { value: "A", label: "A", order: 0, parentValue: "B" },
      { value: "B", label: "B", order: 1, parentValue: "A" },
      { value: "SELF", label: "S", order: 2, parentValue: "SELF" },
    ]);
    const values = errors.map((e) => e.value).sort();
    expect(values).toEqual(["A", "B", "SELF"]);
  });
});

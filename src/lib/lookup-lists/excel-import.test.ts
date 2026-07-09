import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseLookupItemsFromWorkbook } from "./excel-import";

async function makeBuffer(rows: [string, string][]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(["value", "label"]);
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

describe("parseLookupItemsFromWorkbook", () => {
  it("parses value/label rows, skipping the header and blanks", async () => {
    const buf = await makeBuffer([["ATH", "Αθήνα"], ["THE", "Θεσσαλονίκη"], ["", ""]]);
    const items = await parseLookupItemsFromWorkbook(buf);
    expect(items).toEqual([
      { value: "ATH", label: "Αθήνα", order: 0 },
      { value: "THE", label: "Θεσσαλονίκη", order: 1 },
    ]);
  });
  it("falls back label=value when only one column", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    ws.addRow(["value"]); ws.addRow(["SOLO"]);
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const items = await parseLookupItemsFromWorkbook(buf);
    expect(items).toEqual([{ value: "SOLO", label: "SOLO", order: 0 }]);
  });
});

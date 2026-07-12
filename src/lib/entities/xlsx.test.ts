import { describe, it, expect } from "vitest";
import { buildTemplateWorkbook, parseEntityWorkbook } from "./xlsx";

describe("entity xlsx", () => {
  it("template has header row matching registry headers", async () => {
    const buf = await buildTemplateWorkbook("SUPPLIER");
    const parsed = await parseEntityWorkbook("SUPPLIER", buf);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors).toHaveLength(0);
  });

  it("parses valid rows and reports per-row errors", async () => {
    // build a workbook with header + 3 rows: valid, missing name, duplicate code
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Χρώματα");
    ws.addRow(["Κωδικός*", "Όνομα*", "Ενεργός"]);
    ws.addRow(["C01", "Κόκκινο", "ΝΑΙ"]);
    ws.addRow(["C02", "", ""]);
    ws.addRow(["C01", "Διπλό", ""]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const parsed = await parseEntityWorkbook("COLOR", buf);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({ code: "C01", name: "Κόκκινο", isActive: true });
    expect(parsed.errors).toHaveLength(2);
    expect(parsed.errors[0].rowNumber).toBe(3);
    expect(parsed.errors[1].rowNumber).toBe(4); // duplicate code within file
  });

  it("rejects a workbook with wrong headers", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("x").addRow(["Foo", "Bar"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    await expect(parseEntityWorkbook("COLOR", buf)).rejects.toThrow();
  });
});

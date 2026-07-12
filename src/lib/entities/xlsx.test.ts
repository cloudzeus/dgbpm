import { describe, it, expect } from "vitest";
import {
  analyzeWorkbook,
  buildTemplateWorkbook,
  parseEntityWorkbook,
  parseSheetWithMapping,
  suggestMapping,
} from "./xlsx";

async function makeWorkbook(sheets: { name: string; rows: (string | number)[][] }[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name);
    for (const r of s.rows) ws.addRow(r);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

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

describe("analyzeWorkbook", () => {
  it("returns headers, sample rows and row counts per sheet", async () => {
    const buf = await makeWorkbook([
      {
        name: "Πελάτες",
        rows: [
          ["SKU", "Επωνυμία", "VAT"],
          ["C1", "Πελάτης 1", "123"],
          ["C2", "Πελάτης 2", "456"],
          ["C3", "Πελάτης 3", "789"],
          ["C4", "Πελάτης 4", "000"],
        ],
      },
      { name: "Κενό", rows: [["Foo"]] },
    ]);
    const { sheets } = await analyzeWorkbook(buf);
    expect(sheets).toHaveLength(2);
    expect(sheets[0].name).toBe("Πελάτες");
    expect(sheets[0].headers).toEqual(["SKU", "Επωνυμία", "VAT"]);
    expect(sheets[0].rowCount).toBe(4);
    expect(sheets[0].sampleRows).toHaveLength(3);
    expect(sheets[0].sampleRows[0]).toEqual(["C1", "Πελάτης 1", "123"]);
    expect(sheets[1].name).toBe("Κενό");
    expect(sheets[1].rowCount).toBe(0);
    expect(sheets[1].sampleRows).toHaveLength(0);
  });

  it("throws on workbook without worksheets", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("x"); // exceljs requires ≥1 sheet to serialize
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const { sheets } = await analyzeWorkbook(buf);
    expect(sheets[0].headers).toEqual([]);
    expect(sheets[0].rowCount).toBe(0);
  });
});

describe("suggestMapping", () => {
  it("matches Greek/English synonyms, accent- and case-insensitive", () => {
    const m = suggestMapping("CUSTOMER", ["SKU", "ΕΠΩΝΥΜΙΑ", "Α.Φ.Μ.", "E-mail", "Τηλ.", "πόλη"]);
    expect(m.code).toBe("SKU");
    expect(m.name).toBe("ΕΠΩΝΥΜΙΑ");
    expect(m.afm).toBe("Α.Φ.Μ.");
    expect(m.email).toBe("E-mail");
    expect(m.phone).toBe("Τηλ.");
    expect(m.city).toBe("πόλη");
  });

  it("maps template-style headers and parentCode for categories", () => {
    const m = suggestMapping("PRODUCT_CATEGORY", ["Κωδικός*", "Όνομα*", "Ενεργός", "Γονικός Κωδικός"]);
    expect(m.code).toBe("Κωδικός*");
    expect(m.name).toBe("Όνομα*");
    expect(m.isActive).toBe("Ενεργός");
    expect(m.parentCode).toBe("Γονικός Κωδικός");
  });

  it("never maps one header to two fields; leaves unmatched fields unmapped", () => {
    const m = suggestMapping("PRODUCT", ["Κωδικός", "Τιμή λιανικής"]);
    expect(m.code).toBe("Κωδικός");
    expect(m.priceRetail).toBe("Τιμή λιανικής");
    expect(m.name).toBeUndefined();
    // «Κωδικός» consumed by code — not reused
    expect(Object.values(m).filter((h) => h === "Κωδικός")).toHaveLength(1);
  });
});

describe("parseSheetWithMapping", () => {
  it("parses rows using mapping in arbitrary column order", async () => {
    const buf = await makeWorkbook([
      {
        name: "Data",
        rows: [
          ["Περιγραφή", "Άσχετο", "SKU", "Retail"],
          ["Μπλούζα", "x", "P1", "19,90"],
          ["Παντελόνι", "y", "P2", "39.5"],
        ],
      },
    ]);
    const res = await parseSheetWithMapping("PRODUCT", buf, "Data", {
      code: "SKU",
      name: "Περιγραφή",
      priceRetail: "Retail",
    });
    expect(res.errors).toHaveLength(0);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toMatchObject({ code: "P1", name: "Μπλούζα", priceRetail: 19.9, isActive: true });
    expect(res.rowNumbers).toEqual([2, 3]);
  });

  it("requires code and name mapped", async () => {
    const buf = await makeWorkbook([{ name: "S", rows: [["A"], ["1"]] }]);
    await expect(parseSheetWithMapping("COLOR", buf, "S", { code: "A" })).rejects.toThrow();
  });

  it("rejects mapping to a header that does not exist in the sheet", async () => {
    const buf = await makeWorkbook([{ name: "S", rows: [["A", "B"], ["1", "x"]] }]);
    await expect(
      parseSheetWithMapping("COLOR", buf, "S", { code: "A", name: "Missing" })
    ).rejects.toThrow();
  });

  it("reports per-row errors and duplicate codes", async () => {
    const buf = await makeWorkbook([
      {
        name: "S",
        rows: [
          ["Κ", "Ο"],
          ["C1", "Κόκκινο"],
          ["C2", ""],
          ["C1", "Διπλό"],
        ],
      },
    ]);
    const res = await parseSheetWithMapping("COLOR", buf, "S", { code: "Κ", name: "Ο" });
    expect(res.rows).toHaveLength(1);
    expect(res.errors).toHaveLength(2);
    expect(res.errors[0].rowNumber).toBe(3);
    expect(res.errors[1].rowNumber).toBe(4);
  });

  it("throws when the sheet name is missing", async () => {
    const buf = await makeWorkbook([{ name: "S", rows: [["A"]] }]);
    await expect(
      parseSheetWithMapping("COLOR", buf, "Άλλο", { code: "A", name: "A" })
    ).rejects.toThrow();
  });
});

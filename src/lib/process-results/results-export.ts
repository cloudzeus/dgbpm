/**
 * Client-side per-template results export (Excel + PDF + Word).
 * Import only from client components. Mirrors src/lib/report-export.ts.
 */
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun } from "docx";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ResultsExport = {
  title: string;
  columns: string[]; // ["Διαδικασία", ...field names]
  rows: string[][]; // each row: [instanceName, ...cell values]
};

export async function exportResultsExcel(d: ResultsExport) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Αποτελέσματα", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(d.columns);
  d.rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${d.title.replace(/\s+/g, "-")}.xlsx`,
  );
}

export async function exportResultsPdf(d: ResultsExport, robotoBase64?: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  if (robotoBase64) {
    doc.addFileToVFS("Roboto.ttf", robotoBase64);
    doc.addFont("Roboto.ttf", "Roboto", "normal");
    doc.setFont("Roboto");
  }
  doc.setFontSize(14);
  doc.text(d.title, 14, 12);
  autoTable(doc, {
    head: [d.columns],
    body: d.rows,
    startY: 18,
    styles: { fontSize: 8, font: robotoBase64 ? "Roboto" : undefined },
  });
  downloadBlob(doc.output("blob"), `${d.title.replace(/\s+/g, "-")}.pdf`);
}

export async function exportResultsWord(d: ResultsExport) {
  const header = new TableRow({
    children: d.columns.map(
      (c) =>
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })] }),
    ),
  });
  const body = d.rows.map(
    (r) => new TableRow({ children: r.map((c) => new TableCell({ children: [new Paragraph(c)] })) }),
  );
  const docx = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun({ text: d.title, bold: true, size: 28 })] }),
          new Table({ rows: [header, ...body] }),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(docx);
  downloadBlob(blob, `${d.title.replace(/\s+/g, "-")}.docx`);
}

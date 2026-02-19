/**
 * Client-side report export (Excel + PDF). Import only from client components.
 */
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Report 1: By User */
export type ReportByUserRow = {
  userId?: string;
  userName: string;
  email: string;
  role: string;
  processesStarted: number;
  tasksAssigned: number;
  tasksApproved: number;
  tasksRejected: number;
  tasksInProgress: number;
  tasksPending: number;
};

const BY_USER_HEADERS = ["User", "Email", "Role", "Processes started", "Tasks assigned", "Approved", "Rejected", "In progress", "Pending"] as const;

export function exportReportByUserToExcel(rows: ReportByUserRow[], title: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("By User", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "User", key: "userName", width: 22 },
    { header: "Email", key: "email", width: 28 },
    { header: "Role", key: "role", width: 14 },
    { header: "Processes started", key: "processesStarted", width: 18 },
    { header: "Tasks assigned", key: "tasksAssigned", width: 16 },
    { header: "Approved", key: "tasksApproved", width: 10 },
    { header: "Rejected", key: "tasksRejected", width: 10 },
    { header: "In progress", key: "tasksInProgress", width: 12 },
    { header: "Pending", key: "tasksPending", width: 10 },
  ];
  ws.addRows(rows);
  ws.getRow(1).font = { bold: true };
  wb.xlsx.writeBuffer().then((buffer) => {
    downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${title.replace(/\s+/g, "-")}-by-user.xlsx`);
  });
}

export function exportReportByUserToPdf(rows: ReportByUserRow[], title: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 12);
  const body = rows.map((r) => [
    r.userName,
    r.email,
    r.role,
    String(r.processesStarted),
    String(r.tasksAssigned),
    String(r.tasksApproved),
    String(r.tasksRejected),
    String(r.tasksInProgress),
    String(r.tasksPending),
  ]);
  autoTable(doc, {
    head: [BY_USER_HEADERS as unknown as string[]],
    body,
    startY: 18,
    styles: { fontSize: 8 },
  });
  downloadBlob(doc.output("blob"), `${title.replace(/\s+/g, "-")}-by-user.pdf`);
}

/** Report 2: By Task */
export type ReportByTaskRow = {
  templateTaskId?: string;
  taskName: string;
  processTemplateName: string;
  totalAssignments: number;
  pending: number;
  inProgress: number;
  approved: number;
  rejected: number;
  skipped: number;
};

const BY_TASK_HEADERS = ["Task", "Process template", "Total", "Pending", "In progress", "Approved", "Rejected", "Skipped"] as const;

export function exportReportByTaskToExcel(rows: ReportByTaskRow[], title: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("By Task", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Task", key: "taskName", width: 28 },
    { header: "Process template", key: "processTemplateName", width: 24 },
    { header: "Total", key: "totalAssignments", width: 8 },
    { header: "Pending", key: "pending", width: 8 },
    { header: "In progress", key: "inProgress", width: 12 },
    { header: "Approved", key: "approved", width: 10 },
    { header: "Rejected", key: "rejected", width: 10 },
    { header: "Skipped", key: "skipped", width: 8 },
  ];
  ws.addRows(rows);
  ws.getRow(1).font = { bold: true };
  wb.xlsx.writeBuffer().then((buffer) => {
    downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${title.replace(/\s+/g, "-")}-by-task.xlsx`);
  });
}

export function exportReportByTaskToPdf(rows: ReportByTaskRow[], title: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 12);
  const body = rows.map((r) => [
    r.taskName,
    r.processTemplateName,
    String(r.totalAssignments),
    String(r.pending),
    String(r.inProgress),
    String(r.approved),
    String(r.rejected),
    String(r.skipped),
  ]);
  autoTable(doc, {
    head: [BY_TASK_HEADERS as unknown as string[]],
    body,
    startY: 18,
    styles: { fontSize: 8 },
  });
  downloadBlob(doc.output("blob"), `${title.replace(/\s+/g, "-")}-by-task.pdf`);
}

/** Report 3: Process summary */
export type ReportSummaryRow = {
  instanceId?: string;
  instanceName: string;
  processTemplateName: string;
  status: string;
  startedByName: string;
  startDate: string;
  endDate: string | null;
  taskCount: number;
  completedTaskCount: number;
};

const SUMMARY_HEADERS = ["Instance", "Template", "Status", "Started by", "Start date", "End date", "Tasks", "Completed"] as const;

export function exportReportSummaryToExcel(rows: ReportSummaryRow[], title: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Instance", key: "instanceName", width: 24 },
    { header: "Template", key: "processTemplateName", width: 22 },
    { header: "Status", key: "status", width: 12 },
    { header: "Started by", key: "startedByName", width: 18 },
    { header: "Start date", key: "startDate", width: 18 },
    { header: "End date", key: "endDate", width: 18 },
    { header: "Tasks", key: "taskCount", width: 8 },
    { header: "Completed", key: "completedTaskCount", width: 10 },
  ];
  ws.addRows(rows.map((r) => ({ ...r, endDate: r.endDate ?? "" })));
  ws.getRow(1).font = { bold: true };
  wb.xlsx.writeBuffer().then((buffer) => {
    downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${title.replace(/\s+/g, "-")}-summary.xlsx`);
  });
}

export function exportReportSummaryToPdf(rows: ReportSummaryRow[], title: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 12);
  const body = rows.map((r) => [
    r.instanceName,
    r.processTemplateName,
    r.status,
    r.startedByName,
    r.startDate,
    r.endDate ?? "",
    String(r.taskCount),
    String(r.completedTaskCount),
  ]);
  autoTable(doc, {
    head: [SUMMARY_HEADERS as unknown as string[]],
    body,
    startY: 18,
    styles: { fontSize: 8 },
  });
  downloadBlob(doc.output("blob"), `${title.replace(/\s+/g, "-")}-summary.pdf`);
}

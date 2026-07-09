import { jsPDF } from "jspdf";
import type { OrgUser } from "./org-avatar";
import type { DeptData } from "./organization-client";

type TreeNode = DeptData & { children: TreeNode[] };

function buildForest(depts: DeptData[]): TreeNode[] {
  const map = new Map<string, TreeNode>(depts.map((d) => [d.id, { ...d, children: [] }]));
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Build and download a hierarchical PDF outline of the whole org chart. */
export async function downloadOrgChartPdf(departments: DeptData[], usersById: Map<string, OrgUser>) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Embed Roboto (Greek-capable) so accented Greek text renders correctly.
  // Loaded lazily to keep the ~1.4MB font data out of the main bundle.
  const { robotoRegularBase64, robotoBoldBase64 } = await import("./roboto-font");
  doc.addFileToVFS("Roboto-Regular.ttf", robotoRegularBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", robotoBoldBase64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");

  const pageHeight = doc.internal.pageSize.getHeight();
  const marginTop = 18;
  const lineHeight = 6;
  let y = marginTop;

  function fullName(u: OrgUser | undefined): string {
    return u ? `${u.firstName} ${u.lastName}` : "—";
  }

  function ensureSpace() {
    if (y > pageHeight - 15) {
      doc.addPage();
      y = marginTop;
    }
  }

  function writeLine(text: string, indentMm: number, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) {
    ensureSpace();
    doc.setFont("Roboto", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.size ?? 10);
    doc.setTextColor(...(opts?.color ?? [30, 30, 34]));
    doc.text(text, 14 + indentMm, y);
    y += lineHeight;
  }

  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.setTextColor(122, 20, 32);
  doc.text("Οργανόγραμμα", 14, y);
  y += lineHeight * 1.6;

  function renderNode(node: TreeNode, depth: number) {
    const indent = depth * 8;
    writeLine(node.name, indent, { bold: true, size: 12, color: [122, 20, 32] });
    for (const pos of node.positions) {
      const manager = pos.managerId ? usersById.get(pos.managerId) : undefined;
      writeLine(`• ${pos.name}`, indent + 6, { bold: true });
      writeLine(`Προϊστάμενος: ${fullName(manager)}`, indent + 12, { color: [90, 90, 100] });
      const employees = pos.users.map((u) => u.user);
      if (employees.length) {
        writeLine(`Υπάλληλοι: ${employees.map(fullName).join(", ")}`, indent + 12, { color: [90, 90, 100] });
      } else {
        writeLine("Υπάλληλοι: —", indent + 12, { color: [90, 90, 100] });
      }
    }
    for (const child of node.children) renderNode(child, depth + 1);
  }

  const forest = buildForest(departments);
  if (forest.length === 0) {
    writeLine("Δεν υπάρχουν τμήματα.", 0);
  } else {
    for (const root of forest) renderNode(root, 0);
  }

  doc.save("organogramma.pdf");
}

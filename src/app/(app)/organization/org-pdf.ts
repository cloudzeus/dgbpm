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

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || "#6366f1").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = parseInt(full, 16);
  if (Number.isNaN(int)) return [99, 102, 241];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

// Base layout units (mm, before fit-to-page scaling)
const NODE_W = 46;
const NODE_H = 17;
const H_GAP = 6;
const V_GAP = 16;

type Placed = { node: TreeNode; depth: number; cx: number; y: number };

/** Tidy-tree layout: leaves get sequential x, parents center over their children. */
function layoutForest(forest: TreeNode[]): { placed: Placed[]; width: number; height: number } {
  const placed: Placed[] = [];
  let leafX = 0;
  let maxDepth = 0;

  function place(node: TreeNode, depth: number): number {
    maxDepth = Math.max(maxDepth, depth);
    const y = depth * (NODE_H + V_GAP);
    let cx: number;
    if (node.children.length === 0) {
      cx = leafX + NODE_W / 2;
      leafX += NODE_W + H_GAP;
    } else {
      const centers = node.children.map((c) => place(c, depth + 1));
      cx = (centers[0] + centers[centers.length - 1]) / 2;
    }
    placed.push({ node, depth, cx, y });
    return cx;
  }

  for (const root of forest) {
    place(root, 0);
    leafX += H_GAP * 3; // extra spacing between separate root trees
  }

  const width = Math.max(...placed.map((p) => p.cx + NODE_W / 2), NODE_W);
  const height = (maxDepth + 1) * NODE_H + maxDepth * V_GAP;
  return { placed, width, height };
}

/** Build and download a visual org-chart PDF (tree diagram + detailed listing). */
export async function downloadOrgChartPdf(departments: DeptData[], usersById: Map<string, OrgUser>) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Embed Roboto (Greek-capable) so accented Greek text renders correctly.
  // Loaded lazily to keep the ~1.4MB font data out of the main bundle.
  const { robotoRegularBase64, robotoBoldBase64 } = await import("./roboto-font");
  doc.addFileToVFS("Roboto-Regular.ttf", robotoRegularBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", robotoBoldBase64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  function fullName(u: OrgUser | undefined): string {
    return u ? `${u.firstName} ${u.lastName}` : "—";
  }

  function truncate(text: string, maxW: number): string {
    if (doc.getTextWidth(text) <= maxW) return text;
    let t = text;
    while (t.length > 1 && doc.getTextWidth(t + "…") > maxW) t = t.slice(0, -1);
    return t + "…";
  }

  const forest = buildForest(departments);

  // ---------- Page 1+: visual tree ----------
  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.setTextColor(122, 20, 32);
  doc.text("Οργανόγραμμα", margin, margin + 4);

  if (forest.length === 0) {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 100);
    doc.text("Δεν υπάρχουν τμήματα.", margin, margin + 16);
  } else {
    const titleSpace = 14;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2 - titleSpace;
    const { placed, width, height } = layoutForest(forest);
    const scale = Math.min(availW / width, availH / height, 1.15);

    const drawW = width * scale;
    const offsetX = margin + Math.max(0, (availW - drawW) / 2);
    const offsetY = margin + titleSpace;
    const X = (baseX: number) => offsetX + baseX * scale;
    const Y = (baseY: number) => offsetY + baseY * scale;

    const byId = new Map(placed.map((p) => [p.node.id, p]));

    // Connector lines first (so boxes sit on top)
    doc.setDrawColor(180, 184, 196);
    doc.setLineWidth(Math.max(0.2, 0.35 * scale));
    for (const p of placed) {
      if (p.node.children.length === 0) continue;
      const parentBottom = Y(p.y + NODE_H);
      const busY = Y(p.y + NODE_H + V_GAP / 2);
      const parentX = X(p.cx);
      doc.line(parentX, parentBottom, parentX, busY);
      const childXs = p.node.children.map((c) => X(byId.get(c.id)!.cx));
      doc.line(Math.min(...childXs), busY, Math.max(...childXs), busY);
      for (const c of p.node.children) {
        const cp = byId.get(c.id)!;
        const childX = X(cp.cx);
        doc.line(childX, busY, childX, Y(cp.y));
      }
    }

    // Node boxes
    const nameSize = Math.min(10, Math.max(6, 9 * scale));
    const subSize = Math.max(5, nameSize * 0.78);
    for (const p of placed) {
      const w = NODE_W * scale;
      const h = NODE_H * scale;
      const px = X(p.cx - NODE_W / 2);
      const py = Y(p.y);

      doc.setDrawColor(224, 224, 230);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(px, py, w, h, 1.4 * scale, 1.4 * scale, "FD");
      // left color accent
      const [r, g, b] = hexToRgb(p.node.color);
      doc.setFillColor(r, g, b);
      doc.rect(px, py + 0.8 * scale, Math.max(1, 1.4 * scale), h - 1.6 * scale, "F");

      doc.setFont("Roboto", "bold");
      doc.setFontSize(nameSize);
      doc.setTextColor(28, 28, 34);
      const name = truncate(p.node.name, w - 5 * scale);
      doc.text(name, px + w / 2, py + h / 2 - h * 0.08, { align: "center", baseline: "middle" });

      const userCount = new Set(p.node.positions.flatMap((pos) => pos.users.map((u) => u.user.id))).size;
      doc.setFont("Roboto", "normal");
      doc.setFontSize(subSize);
      doc.setTextColor(140, 140, 150);
      doc.text(
        `${p.node.positions.length} θέσεις · ${userCount} χρήστες`,
        px + w / 2,
        py + h / 2 + h * 0.26,
        { align: "center", baseline: "middle" }
      );
    }
  }

  // ---------- Detailed listing ----------
  if (forest.length > 0) {
    doc.addPage();
    const lineHeight = 6;
    let y = margin + 4;

    function ensureSpace() {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin + 4;
      }
    }
    function writeLine(text: string, indentMm: number, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) {
      ensureSpace();
      doc.setFont("Roboto", opts?.bold ? "bold" : "normal");
      doc.setFontSize(opts?.size ?? 10);
      doc.setTextColor(...(opts?.color ?? [30, 30, 34]));
      doc.text(truncate(text, pageW - margin * 2 - indentMm), margin + indentMm, y);
      y += lineHeight;
    }

    doc.setFont("Roboto", "bold");
    doc.setFontSize(14);
    doc.setTextColor(122, 20, 32);
    doc.text("Αναλυτικά", margin, y);
    y += lineHeight * 1.6;

    function renderNode(node: TreeNode, depth: number) {
      const indent = depth * 8;
      writeLine(node.name, indent, { bold: true, size: 12, color: [122, 20, 32] });
      for (const pos of node.positions) {
        const manager = pos.managerId ? usersById.get(pos.managerId) : undefined;
        writeLine(`• ${pos.name}`, indent + 6, { bold: true });
        writeLine(`Προϊστάμενος: ${fullName(manager)}`, indent + 12, { color: [90, 90, 100] });
        const employees = pos.users.map((u) => u.user);
        writeLine(
          `Υπάλληλοι: ${employees.length ? employees.map(fullName).join(", ") : "—"}`,
          indent + 12,
          { color: [90, 90, 100] }
        );
      }
      for (const child of node.children) renderNode(child, depth + 1);
    }
    for (const root of forest) renderNode(root, 0);
  }

  doc.save("organogramma.pdf");
}

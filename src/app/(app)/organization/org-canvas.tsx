"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Minus, Plus, Maximize2 } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { OrgAvatarStack, type OrgUser } from "./org-avatar";
import type { DeptData } from "./organization-client";

type TreeNode = DeptData & { children: TreeNode[] };

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2;

function buildForest(depts: DeptData[]): TreeNode[] {
  const map = new Map<string, TreeNode>(depts.map((d) => [d.id, { ...d, children: [] }]));
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function NodeBox({
  dept,
  selected,
  onSelect,
  registerRef,
}: {
  dept: DeptData;
  selected: boolean;
  onSelect: (id: string) => void;
  registerRef: (id: string, el: HTMLElement | null) => void;
}) {
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({ id: `drag:${dept.id}` });
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: `drop:${dept.id}` });
  const employees: OrgUser[] = useMemo(
    () => Array.from(new Map(dept.positions.flatMap((p) => p.users.map((u) => [u.user.id, u.user]))).values()),
    [dept.positions]
  );
  return (
    <div
      ref={(el) => {
        dropRef(el);
        registerRef(dept.id, el);
      }}
      data-orgnode={dept.id}
    >
      <button
        ref={dragRef}
        {...listeners}
        {...attributes}
        onClick={() => onSelect(dept.id)}
        className={cn(
          "group relative min-w-[168px] rounded-xl border border-border/70 bg-card px-4 py-2.5 text-left shadow-sm",
          "border-l-[5px] transition-[transform,box-shadow,border-color] duration-200 will-change-transform",
          "hover:-translate-y-0.5 hover:shadow-lg hover:border-border",
          selected && "ring-2 ring-primary ring-offset-1 ring-offset-background shadow-lg",
          isOver && "ring-2 ring-primary ring-offset-2",
          isDragging && "opacity-50"
        )}
        style={{ borderLeftColor: dept.color }}
      >
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: dept.color }} />
          <div className="text-sm font-semibold text-foreground">{dept.name}</div>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium tabular-nums">
            {dept.positions.length} θέσεις
          </span>
          {employees.length > 0 && <OrgAvatarStack users={employees} />}
        </div>
      </button>
    </div>
  );
}

function Subtree({
  node,
  selectedId,
  onSelect,
  registerRef,
}: {
  node: TreeNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  registerRef: (id: string, el: HTMLElement | null) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <NodeBox dept={node} selected={selectedId === node.id} onSelect={onSelect} registerRef={registerRef} />
      {node.children.length > 0 && (
        <div className="flex items-start gap-8 pt-12">
          {node.children.map((c) => (
            <Subtree key={c.id} node={c} selectedId={selectedId} onSelect={onSelect} registerRef={registerRef} />
          ))}
        </div>
      )}
    </div>
  );
}

type Edge = { id: string; d: string };

export function OrgCanvas({
  departments,
  selectedId,
  onSelect,
  onReparent,
}: {
  departments: DeptData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReparent: (dragId: string, dropId: string | null) => void;
}) {
  const forest = useMemo(() => buildForest(departments), [departments]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());

  const [transform, setTransform] = useState({ x: 40, y: 24, k: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const [edges, setEdges] = useState<Edge[]>([]);
  const [worldSize, setWorldSize] = useState({ w: 0, h: 0 });

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) nodeRefs.current.set(id, el);
    else nodeRefs.current.delete(id);
  }, []);

  // ---- Measure orthogonal connectors between parent → child (in unscaled world coords) ----
  const measure = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    const wRect = world.getBoundingClientRect();
    const k = transformRef.current.k || 1;
    const next: Edge[] = [];
    for (const dept of departments) {
      if (!dept.parentId) continue;
      const parentEl = nodeRefs.current.get(dept.parentId);
      const childEl = nodeRefs.current.get(dept.id);
      if (!parentEl || !childEl) continue;
      const p = parentEl.getBoundingClientRect();
      const c = childEl.getBoundingClientRect();
      const px = (p.left + p.width / 2 - wRect.left) / k;
      const py = (p.bottom - wRect.top) / k;
      const cx = (c.left + c.width / 2 - wRect.left) / k;
      const cy = (c.top - wRect.top) / k;
      const midY = py + (cy - py) / 2;
      const r = 10; // corner radius
      const dir = cx >= px ? 1 : -1;
      const d =
        Math.abs(cx - px) < 1
          ? `M ${px} ${py} L ${cx} ${cy}`
          : `M ${px} ${py} L ${px} ${midY - r} Q ${px} ${midY} ${px + dir * r} ${midY} L ${cx - dir * r} ${midY} Q ${cx} ${midY} ${cx} ${midY + r} L ${cx} ${cy}`;
      next.push({ id: dept.id, d });
    }
    setWorldSize({ w: world.offsetWidth, h: world.offsetHeight });
    setEdges(next);
  }, [departments]);

  useLayoutEffect(() => {
    measure();
  }, [measure, forest]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(world);
    for (const el of nodeRefs.current.values()) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // ---- GSAP: node entrance stagger when the tree shape changes ----
  const forestSig = useMemo(() => departments.map((d) => d.id).join(","), [departments]);
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const nodes = world.querySelectorAll("[data-orgnode]");
    const ctx = gsap.context(() => {
      gsap.from(nodes, {
        opacity: 0,
        scale: 0.88,
        y: 10,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.03,
        clearProps: "all",
      });
    }, world);
    return () => ctx.revert();
  }, [forestSig]);

  // ---- GSAP: draw-in connectors whenever edges recompute ----
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const paths = svg.querySelectorAll<SVGPathElement>("path[data-edge]");
    const ctx = gsap.context(() => {
      paths.forEach((path) => {
        const len = path.getTotalLength();
        gsap.fromTo(
          path,
          { strokeDasharray: len, strokeDashoffset: len },
          {
            strokeDashoffset: 0,
            duration: 0.5,
            ease: "power2.inOut",
            onComplete: () => {
              path.style.strokeDasharray = "";
              path.style.strokeDashoffset = "";
            },
          }
        );
      });
    }, svg);
    return () => ctx.revert();
  }, [edges]);

  // ---- Wheel zoom centered on pointer ----
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setTransform((t) => {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.k * factor));
        const scale = k / t.k;
        return { k, x: mx - (mx - t.x) * scale, y: my - (my - t.y) * scale };
      });
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

  // ---- Pan by dragging the background (not nodes / controls) ----
  const panState = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  function onPointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-orgnode]") || target.closest("[data-controls]")) return;
    if (e.button !== 0) return;
    panState.current = { startX: e.clientX, startY: e.clientY, ox: transform.x, oy: transform.y };
    setIsPanning(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = panState.current;
    if (!p) return;
    setTransform((t) => ({ ...t, x: p.ox + (e.clientX - p.startX), y: p.oy + (e.clientY - p.startY) }));
  }
  function endPan(e: React.PointerEvent) {
    if (!panState.current) return;
    panState.current = null;
    setIsPanning(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  // ---- Button controls: zoom about viewport centre / fit ----
  function zoomBy(factor: number) {
    const vp = viewportRef.current;
    if (!vp) return;
    const cx = vp.clientWidth / 2;
    const cy = vp.clientHeight / 2;
    setTransform((t) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.k * factor));
      const scale = k / t.k;
      return { k, x: cx - (cx - t.x) * scale, y: cy - (cy - t.y) * scale };
    });
  }

  const fit = useCallback(() => {
    const vp = viewportRef.current;
    const world = worldRef.current;
    if (!vp || !world) return;
    const pad = 48;
    const cw = vp.clientWidth - pad * 2;
    const ch = vp.clientHeight - pad * 2;
    const ww = world.offsetWidth || 1;
    const wh = world.offsetHeight || 1;
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(cw / ww, ch / wh, 1)));
    const x = (vp.clientWidth - ww * k) / 2;
    const y = pad;
    gsap.to(transformRef.current, {
      x,
      y,
      k,
      duration: 0.5,
      ease: "power2.inOut",
      onUpdate: () => setTransform({ ...transformRef.current }),
    });
  }, []);

  function handleDragEnd(e: DragEndEvent) {
    const dragId = String(e.active.id).replace("drag:", "");
    const over = e.over ? String(e.over.id).replace("drop:", "") : null;
    if (over === null) onReparent(dragId, null);
    else if (over !== dragId) onReparent(dragId, over);
  }

  return (
    <div
      ref={viewportRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
      className={cn(
        "relative h-full touch-none select-none overflow-hidden rounded-lg border bg-muted/20",
        "[background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:20px_20px]",
        isPanning ? "cursor-grabbing" : "cursor-grab"
      )}
    >
      <div data-controls className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-md border bg-card p-1 shadow-sm">
        <button className="rounded p-1 hover:bg-muted" onClick={() => zoomBy(1 / 1.2)} title="Σμίκρυνση"><Minus className="size-4" /></button>
        <span className="w-10 text-center text-xs tabular-nums">{Math.round(transform.k * 100)}%</span>
        <button className="rounded p-1 hover:bg-muted" onClick={() => zoomBy(1.2)} title="Μεγέθυνση"><Plus className="size-4" /></button>
        <button className="rounded p-1 hover:bg-muted" onClick={fit} title="Προσαρμογή"><Maximize2 className="size-4" /></button>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-3 z-20 text-[10px] text-muted-foreground">
        Ροδέλα ποντικιού: zoom · Σύρε το φόντο: μετακίνηση · Σύρε κουτί πάνω σε άλλο: αλλαγή γονέα
      </div>

      <DndContext id="org-canvas-dnd" sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          ref={worldRef}
          className="absolute left-0 top-0 w-max p-6"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
            transformOrigin: "0 0",
          }}
        >
          <svg
            ref={svgRef}
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width={worldSize.w || "100%"}
            height={worldSize.h || "100%"}
          >
            {edges.map((edge) => (
              <path
                key={edge.id}
                data-edge={edge.id}
                d={edge.d}
                fill="none"
                stroke="var(--border)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
          <div className="relative flex items-start justify-center gap-10">
            {forest.map((root) => (
              <Subtree key={root.id} node={root} selectedId={selectedId} onSelect={onSelect} registerRef={registerRef} />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}

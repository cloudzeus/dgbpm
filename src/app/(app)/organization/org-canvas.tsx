"use client";

import { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrgAvatarStack, type OrgUser } from "./org-avatar";
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

function NodeBox({ dept, selected, onSelect }: { dept: DeptData; selected: boolean; onSelect: (id: string) => void }) {
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({ id: `drag:${dept.id}` });
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: `drop:${dept.id}` });
  const employees: OrgUser[] = useMemo(
    () => Array.from(new Map(dept.positions.flatMap((p) => p.users.map((u) => [u.user.id, u.user]))).values()),
    [dept.positions]
  );
  return (
    <div ref={dropRef}>
      <button
        ref={dragRef}
        {...listeners}
        {...attributes}
        onClick={() => onSelect(dept.id)}
        className={cn(
          "min-w-[150px] rounded-[10px] border border-border bg-card px-4 py-2 text-left shadow-sm transition",
          "border-l-4",
          selected && "ring-2 ring-primary",
          isOver && "ring-2 ring-primary ring-offset-2",
          isDragging && "opacity-50"
        )}
        style={{ borderLeftColor: dept.color }}
      >
        <div className="text-sm font-semibold text-foreground">{dept.name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {dept.positions.length} θέσεις
          {employees.length > 0 && <OrgAvatarStack users={employees} />}
        </div>
      </button>
    </div>
  );
}

function Subtree({ node, selectedId, onSelect }: { node: TreeNode; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col items-center">
      <NodeBox dept={node} selected={selectedId === node.id} onSelect={onSelect} />
      {node.children.length > 0 && (
        <>
          <div className="h-4 w-px bg-border" />
          <div className="flex gap-6">
            {node.children.map((c) => (
              <Subtree key={c.id} node={c} selectedId={selectedId} onSelect={onSelect} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
  const [zoom, setZoom] = useState(1);
  const forest = useMemo(() => buildForest(departments), [departments]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(e: DragEndEvent) {
    const dragId = String(e.active.id).replace("drag:", "");
    // Dropped over another node → reparent under it; dropped on empty canvas → move to root.
    const over = e.over ? String(e.over.id).replace("drop:", "") : null;
    if (over === null) onReparent(dragId, null);
    else if (over !== dragId) onReparent(dragId, over);
  }

  return (
    <div className="relative h-full overflow-auto rounded-lg border bg-muted/20 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:18px_18px]">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border bg-card p-1 shadow-sm">
        <button className="rounded p-1 hover:bg-muted" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}><Minus className="size-4" /></button>
        <span className="w-10 text-center text-xs">{Math.round(zoom * 100)}%</span>
        <button className="rounded p-1 hover:bg-muted" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}><Plus className="size-4" /></button>
        <button className="rounded p-1 hover:bg-muted" onClick={() => setZoom(1)} title="Fit"><Maximize2 className="size-4" /></button>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-3 z-10 text-[10px] text-muted-foreground">
        Σύρε κουτί πάνω σε άλλο για αλλαγή γονέα · σε κενό χώρο για μεταφορά σε ρίζα
      </div>
      <DndContext id="org-canvas-dnd" sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="min-h-[400px] w-max min-w-full origin-top p-10" style={{ transform: `scale(${zoom})` }}>
          <div className="flex items-start justify-center gap-10">
            {forest.map((root) => (
              <Subtree key={root.id} node={root} selectedId={selectedId} onSelect={onSelect} />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}

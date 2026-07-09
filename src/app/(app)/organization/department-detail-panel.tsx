"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ChevronRight, ChevronDown, X, Repeat, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrgAvatar, OrgAvatarStack, type OrgUser } from "./org-avatar";
import type { DeptData } from "./organization-client";

type Position = DeptData["positions"][number];

function PositionCard({
  position,
  usersById,
  onOpenManagerPicker,
  onClearManager,
  onOpenEmployeePicker,
  onRemoveEmployee,
  onRename,
  onDelete,
}: {
  position: Position;
  usersById: Map<string, OrgUser>;
  onOpenManagerPicker: (positionId: string) => void;
  onClearManager: (positionId: string) => void;
  onOpenEmployeePicker: (positionId: string) => void;
  onRemoveEmployee: (positionId: string, userId: string) => void;
  onRename: (positionId: string, name: string) => void;
  onDelete: (positionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: `poszone:${position.id}` });
  const employees = position.users.map((u) => u.user);
  const manager = position.managerId ? usersById.get(position.managerId) : undefined;

  return (
    <div className={cn("rounded-[9px] border", open ? "border-primary/40 bg-muted/30" : "border-border")}>
      <button className="flex w-full items-center justify-between px-3 py-2" onClick={() => setOpen((o) => !o)}>
        <span className="flex items-center gap-1 text-sm font-semibold">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          {position.name}
        </span>
        {!open && employees.length > 0 && <OrgAvatarStack users={employees} />}
      </button>

      {open && (
        <div ref={setNodeRef} className={cn("px-3 pb-3", isOver && "rounded-b-[9px] ring-2 ring-primary ring-inset")}>
          <div className="flex items-center justify-end gap-3 pb-2 text-xs text-muted-foreground">
            <button className="hover:text-foreground" onClick={() => { const n = prompt("Όνομα θέσης", position.name); if (n) onRename(position.id, n); }}>✎ μετονομασία</button>
            <button className="hover:text-destructive" onClick={() => onDelete(position.id)}><Trash2 className="size-3.5" /></button>
          </div>

          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Προϊστάμενος</div>
          {manager ? (
            <div className="mt-1 flex items-center gap-2 rounded-md border bg-card p-1.5">
              <OrgAvatar user={manager} />
              <div className="text-sm font-medium">{manager.firstName} {manager.lastName}</div>
              <div className="ml-auto flex gap-1.5 text-muted-foreground">
                <button title="Αλλαγή" onClick={() => onOpenManagerPicker(position.id)}><Repeat className="size-3.5" /></button>
                <button title="Αφαίρεση" onClick={() => onClearManager(position.id)}><X className="size-3.5" /></button>
              </div>
            </div>
          ) : (
            <button className="mt-1 w-full rounded-md border border-dashed p-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary" onClick={() => onOpenManagerPicker(position.id)}>
              ＋ Ορισμός προϊσταμένου
            </button>
          )}

          <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Υπάλληλοι · {employees.length}</div>
          {employees.map((u) => (
            <div key={u.id} className="mt-1 flex items-center gap-2 rounded-md border bg-card p-1.5">
              <OrgAvatar user={u} />
              <div className="text-sm font-medium">{u.firstName} {u.lastName}</div>
              <button className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => onRemoveEmployee(position.id, u.id)}><X className="size-3.5" /></button>
            </div>
          ))}
          <button
            className={cn("mt-2 w-full rounded-md border border-dashed p-2 text-sm text-muted-foreground hover:border-primary hover:text-primary", isOver && "border-primary bg-primary/5 text-primary")}
            onClick={() => onOpenEmployeePicker(position.id)}
          >
            ⤵ Σύρε avatar εδώ · ή ＋ επιλογή
          </button>
        </div>
      )}
    </div>
  );
}

export function DepartmentDetailPanel({
  department,
  parentName,
  usersById,
  onAddPosition,
  onRenameDepartment,
  ...cardProps
}: {
  department: DeptData | null;
  parentName: string | null;
  usersById: Map<string, OrgUser>;
  onAddPosition: (departmentId: string) => void;
  onRenameDepartment: (id: string, name: string) => void;
  onOpenManagerPicker: (positionId: string) => void;
  onClearManager: (positionId: string) => void;
  onOpenEmployeePicker: (positionId: string) => void;
  onRemoveEmployee: (positionId: string, userId: string) => void;
  onRename: (positionId: string, name: string) => void;
  onDelete: (positionId: string) => void;
}) {
  if (!department) {
    return <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">Επίλεξε ένα τμήμα από τον καμβά για να δεις τις θέσεις του.</div>;
  }
  return (
    <div className="flex h-full flex-col gap-2 overflow-auto p-4">
      <div>
        <button className="text-lg font-bold" onClick={() => { const n = prompt("Όνομα τμήματος", department.name); if (n) onRenameDepartment(department.id, n); }}>{department.name}</button>
        <div className="text-[11px] text-muted-foreground">{parentName ? `${parentName} › ` : ""}{department.name}</div>
      </div>
      {department.positions.map((p) => (
        <PositionCard key={p.id} position={p} usersById={usersById} {...cardProps} />
      ))}
      <button className="mt-1 rounded-md border border-dashed p-2 text-sm text-muted-foreground hover:border-primary hover:text-primary" onClick={() => onAddPosition(department.id)}>
        <Plus className="mr-1 inline size-4" />Νέα θέση εργασίας
      </button>
    </div>
  );
}

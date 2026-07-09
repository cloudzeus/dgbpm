"use client";

import { useMemo, useState, useTransition } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus, Users, Check, Loader2, AlertTriangle } from "lucide-react";
import type { OrgUser } from "./org-avatar";
import { OrgCanvas } from "./org-canvas";
import { DepartmentDetailPanel } from "./department-detail-panel";
import { UserPoolDrawer, UserPickerDialog } from "./user-pool-drawer";
import {
  createDepartmentNode, reparentDepartment, renameDepartment,
  createPosition, renamePosition, deletePosition,
  setPositionManager, assignUserToPosition, removeUserFromPosition,
} from "./actions";

export type DeptData = {
  id: string; name: string; color: string; parentId: string | null;
  email: string | null; phoneNumber: string | null;
  positions: { id: string; name: string; managerId: string | null; users: { user: OrgUser }[] }[];
};

type SaveState = "idle" | "saving" | "saved" | "error";
type PickerTarget = { positionId: string; mode: "manager" | "employee" } | null;

export function OrganizationClient({ departments, users }: { departments: DeptData[]; users: OrgUser[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(departments[0]?.id ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [, startTransition] = useTransition();

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const selected = departments.find((d) => d.id === selectedId) ?? null;
  const parentName = selected?.parentId ? departments.find((d) => d.id === selected.parentId)?.name ?? null : null;
  const selectedAssigned = useMemo(
    () => new Set((selected?.positions ?? []).flatMap((p) => p.users.map((u) => u.user.id))),
    [selected]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function run(fn: () => Promise<void>) {
    setSave("saving");
    startTransition(async () => {
      try { await fn(); setSave("saved"); }
      catch (e) { setSave("error"); alert(e instanceof Error ? e.message : "Σφάλμα αποθήκευσης"); }
    });
  }

  function handleDrawerDrop(e: DragEndEvent) {
    const activeId = String(e.active.id);
    if (!activeId.startsWith("user:") || !e.over) return;
    const overId = String(e.over.id);
    if (!overId.startsWith("poszone:")) return;
    const userId = activeId.replace("user:", "");
    const positionId = overId.replace("poszone:", "");
    run(() => assignUserToPosition(positionId, userId));
  }

  const cardProps = {
    usersById,
    onOpenManagerPicker: (positionId: string) => setPicker({ positionId, mode: "manager" as const }),
    onClearManager: (positionId: string) => run(() => setPositionManager(positionId, null)),
    onOpenEmployeePicker: (positionId: string) => setPicker({ positionId, mode: "employee" as const }),
    onRemoveEmployee: (positionId: string, userId: string) => run(() => removeUserFromPosition(positionId, userId)),
    onRename: (positionId: string, name: string) => run(() => renamePosition(positionId, name)),
    onDelete: (positionId: string) => run(() => deletePosition(positionId)),
  };

  return (
    <div className="rounded-lg border">
      {/* toolbar */}
      <div className="flex items-center gap-3 border-b p-2 text-sm">
        <button className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground" onClick={() => run(() => createDepartmentNode(selectedId))}>
          <Plus className="mr-1 inline size-4" />Τμήμα
        </button>
        <div className="ml-auto flex items-center gap-3">
          <button className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5" onClick={() => setDrawerOpen(true)}>
            <Users className="size-4" />Ανάθεση χρηστών
          </button>
          {save === "saving" && <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Αποθήκευση…</span>}
          {save === "saved" && <span className="flex items-center gap-1 text-green-600"><Check className="size-4" />Αποθηκεύτηκε</span>}
          {save === "error" && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="size-4" />Σφάλμα</span>}
        </div>
      </div>

      {/* body: canvas + panel; a single DndContext covers pool→poszone drops */}
      <DndContext sensors={sensors} onDragEnd={handleDrawerDrop}>
        <div className="flex h-[calc(100vh-16rem)]">
          <div className="flex-1 p-3">
            <OrgCanvas
              departments={departments}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onReparent={(dragId, dropId) => run(() => reparentDepartment(dragId, dropId))}
            />
          </div>
          <div className="w-[280px] border-l">
            <DepartmentDetailPanel
              department={selected}
              parentName={parentName}
              onAddPosition={(departmentId) => run(() => createPosition(departmentId))}
              onRenameDepartment={(id, name) => run(() => renameDepartment(id, name))}
              {...cardProps}
            />
          </div>
        </div>

        <UserPoolDrawer open={drawerOpen} onOpenChange={setDrawerOpen} users={users} assignedUserIds={selectedAssigned} />
      </DndContext>

      <UserPickerDialog
        open={picker !== null}
        onOpenChange={(o) => { if (!o) setPicker(null); }}
        users={users}
        title={picker?.mode === "manager" ? "Επιλογή προϊσταμένου" : "Ανάθεση υπαλλήλου"}
        onPick={(userId) => {
          if (!picker) return;
          if (picker.mode === "manager") run(() => setPositionManager(picker.positionId, userId));
          else run(() => assignUserToPosition(picker.positionId, userId));
        }}
      />
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Plus, Users, Check, Loader2, AlertTriangle, FileDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { OrgUser } from "./org-avatar";
import { OrgCanvas } from "./org-canvas";
import { DepartmentDetailPanel } from "./department-detail-panel";
import { UserPoolDrawer, UserPickerDialog } from "./user-pool-drawer";
import { DepartmentEditDialog, type DepartmentMeta } from "./department-edit-dialog";
import { PromptDialog } from "./prompt-dialog";
import {
  createDepartmentNode, reparentDepartment, updateDepartmentMeta, deleteDepartmentNode,
  createPosition, renamePosition, deletePosition, reorderPositions,
  setPositionManager, assignUserToPosition, removeUserFromPosition,
} from "./actions";
import { downloadOrgChartPdf } from "./org-pdf";

export type DeptData = {
  id: string; name: string; color: string; parentId: string | null;
  email: string | null; phoneNumber: string | null;
  positions: { id: string; name: string; managerId: string | null; users: { user: OrgUser }[] }[];
};

type SaveState = "idle" | "saving" | "saved" | "error";
type PickerTarget = { positionId: string; mode: "manager" | "employee" } | null;
type PosPrompt = { id: string; name: string } | null;
type Confirm = { title: string; description: string; action: () => Promise<void> } | null;

export function OrganizationClient({ departments, users }: { departments: DeptData[]; users: OrgUser[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(departments[0]?.id ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editDept, setEditDept] = useState<DeptData | null>(null);
  const [posRename, setPosRename] = useState<PosPrompt>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
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
      catch (e) { setSave("error"); setErrorMsg(e instanceof Error ? e.message : "Σφάλμα αποθήκευσης"); }
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    if (!e.over) return;
    const overId = String(e.over.id);

    // A user avatar dropped onto a position (drop-zone or the sortable card itself)
    if (activeId.startsWith("user:")) {
      const userId = activeId.slice("user:".length);
      let positionId: string | null = null;
      if (overId.startsWith("poszone:")) positionId = overId.slice("poszone:".length);
      else if (overId.startsWith("sortpos:")) positionId = overId.slice("sortpos:".length);
      if (positionId) run(() => assignUserToPosition(positionId!, userId));
      return;
    }

    // Reordering positions within the selected department
    if (activeId.startsWith("sortpos:") && overId.startsWith("sortpos:") && activeId !== overId) {
      const ids = (selected?.positions ?? []).map((p) => p.id);
      const from = ids.indexOf(activeId.slice("sortpos:".length));
      const to = ids.indexOf(overId.slice("sortpos:".length));
      if (from === -1 || to === -1) return;
      const next = arrayMove(ids, from, to);
      run(() => reorderPositions(next));
    }
  }

  const cardProps = {
    usersById,
    onOpenManagerPicker: (positionId: string) => setPicker({ positionId, mode: "manager" as const }),
    onClearManager: (positionId: string) => run(() => setPositionManager(positionId, null)),
    onOpenEmployeePicker: (positionId: string) => setPicker({ positionId, mode: "employee" as const }),
    onRemoveEmployee: (positionId: string, userId: string) => run(() => removeUserFromPosition(positionId, userId)),
    onRequestRename: (positionId: string, currentName: string) => setPosRename({ id: positionId, name: currentName }),
    onRequestDelete: (positionId: string, currentName: string) =>
      setConfirm({
        title: "Διαγραφή θέσης εργασίας",
        description: `Σίγουρα θέλεις να διαγράψεις τη θέση «${currentName}»; Οι αναθέσεις χρηστών σε αυτή τη θέση θα αφαιρεθούν.`,
        action: () => deletePosition(positionId),
      }),
  };

  return (
    <div className="rounded-lg border">
      {/* toolbar */}
      <div className="flex items-center gap-3 border-b p-2 text-sm">
        <button className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground" onClick={() => run(() => createDepartmentNode(selectedId))}>
          <Plus className="mr-1 inline size-4" />Τμήμα
        </button>
        <div className="ml-auto flex items-center gap-3">
          <button className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5" onClick={() => downloadOrgChartPdf(departments, usersById)}>
            <FileDown className="size-4" />Εξαγωγή PDF
          </button>
          <button className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5" onClick={() => setDrawerOpen(true)}>
            <Users className="size-4" />Ανάθεση χρηστών
          </button>
          {save === "saving" && <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Αποθήκευση…</span>}
          {save === "saved" && <span className="flex items-center gap-1 text-green-600"><Check className="size-4" />Αποθηκεύτηκε</span>}
          {save === "error" && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="size-4" />Σφάλμα</span>}
        </div>
      </div>

      {/* body: canvas + panel; a single DndContext covers pool→poszone drops */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
              onEditDepartment={(dept) => setEditDept(dept)}
              onDeleteDepartment={(dept) =>
                setConfirm({
                  title: "Διαγραφή τμήματος",
                  description: `Σίγουρα θέλεις να διαγράψεις το τμήμα «${dept.name}»; Τυχόν υποτμήματα θα μεταφερθούν στον γονέα του και οι θέσεις του θα διαγραφούν.`,
                  action: () => deleteDepartmentNode(dept.id),
                })
              }
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

      <DepartmentEditDialog
        key={editDept?.id ?? "none"}
        department={editDept}
        open={editDept !== null}
        onOpenChange={(o) => { if (!o) setEditDept(null); }}
        onSave={(id: string, meta: DepartmentMeta) => run(() => updateDepartmentMeta(id, meta))}
      />

      <PromptDialog
        key={posRename?.id ?? "none"}
        open={posRename !== null}
        onOpenChange={(o) => { if (!o) setPosRename(null); }}
        title="Μετονομασία θέσης"
        label="Όνομα θέσης"
        initial={posRename?.name ?? ""}
        onSubmit={(name) => { if (posRename) run(() => renamePosition(posRename.id, name)); }}
      />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Άκυρο</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => { if (confirm) run(confirm.action); }}
            >
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={errorMsg !== null} onOpenChange={(o) => { if (!o) setErrorMsg(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Σφάλμα</AlertDialogTitle>
            <AlertDialogDescription>{errorMsg}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorMsg(null)}>Εντάξει</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

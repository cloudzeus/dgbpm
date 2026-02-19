"use client";

import { useState, useRef, useCallback, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { gsap } from "gsap";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProcessIcon } from "@/lib/process-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RichTextComment } from "@/components/rich-text-comment";
import {
  startProcessInstance,
  approveTask,
  rejectTask,
  startTask,
  uploadTaskFile,
} from "@/app/(app)/process-instances/actions";
import { cn } from "@/lib/utils";

const KANBAN_COLUMNS = ["PENDING", "IN_PROGRESS", "APPROVED", "REJECTED", "SKIPPED"] as const;
type KanbanStatus = (typeof KANBAN_COLUMNS)[number];

const COLUMN_COLORS: Record<KanbanStatus, string> = {
  PENDING: "border-amber-500 bg-amber-500/10",
  IN_PROGRESS: "border-blue-500 bg-blue-500/10",
  APPROVED: "border-emerald-500 bg-emerald-500/10",
  REJECTED: "border-red-500 bg-red-500/10",
  SKIPPED: "border-zinc-500 bg-zinc-500/10",
};

const CARD_COLORS: Record<KanbanStatus, string> = {
  PENDING: "border-amber-500/60 bg-amber-500/20 text-white",
  IN_PROGRESS: "border-blue-500/60 bg-blue-500/20 text-white",
  APPROVED: "border-emerald-500/60 bg-emerald-500/20 text-white",
  REJECTED: "border-red-500/60 bg-red-500/20 text-white",
  SKIPPED: "border-zinc-500/60 bg-zinc-500/20 text-white",
};

const TEMPLATE_CARD_ICON_AND_TEXT: string[] = [
  "text-emerald-500",
  "text-blue-500",
  "text-amber-500",
  "text-red-500",
  "text-zinc-400",
];

export type DashboardTemplate = { id: string; name: string; description: string | null; icon: string };
export type DashboardTask = {
  id: string;
  status: string;
  fileUrl: string | null;
  processInstance: {
    name: string;
    processTemplate: { name: string; icon: string };
    startedBy: { firstName: string; lastName: string };
  };
  templateTask: { name: string; needFile: boolean; mandatory: boolean };
  possibleAssignees: { id: string }[];
};

function KanbanCard({
  task,
  status,
  isDragging,
  isGhost,
  style,
}: {
  task: DashboardTask;
  status: KanbanStatus;
  isDragging?: boolean;
  isGhost?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border-2 p-3 shadow-sm transition-all",
        CARD_COLORS[status],
        isDragging && "opacity-95 scale-105 shadow-lg ring-2 ring-white/30",
        isGhost && "pointer-events-none z-[100]"
      )}
      style={style}
    >
      <div className="flex items-start gap-2">
        <ProcessIcon
          icon={task.processInstance.processTemplate.icon}
          className="size-4 shrink-0 opacity-80 mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{task.templateTask.name}</p>
          <p className="text-xs opacity-90 truncate">{task.processInstance.name}</p>
          <p className="text-xs opacity-80">
            {task.processInstance.startedBy.firstName} {task.processInstance.startedBy.lastName}
          </p>
        </div>
      </div>
    </div>
  );
}

function DraggableKanbanCard({
  task,
  status,
  canDrag,
  onTaskClick,
}: {
  task: DashboardTask;
  status: KanbanStatus;
  canDrag: boolean;
  onTaskClick?: (task: DashboardTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: !canDrag,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleClick = useCallback(() => {
    if (onTaskClick && !isDragging) onTaskClick(task);
  }, [onTaskClick, task, isDragging]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-draggable-id={task.id}
      data-kanban-card
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (onTaskClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onTaskClick(task);
        }
      }}
      className={cn(canDrag && "cursor-grab active:cursor-grabbing", onTaskClick && "cursor-pointer")}
    >
      <KanbanCard task={task} status={status} isDragging={isDragging} />
    </div>
  );
}

/** Static column for SSR/first paint to avoid @dnd-kit hydration mismatch (aria-describedby IDs differ server vs client). */
function StaticKanbanColumn({
  status,
  tasks,
  onTaskClick,
}: {
  status: KanbanStatus;
  tasks: DashboardTask[];
  onTaskClick?: (task: DashboardTask) => void;
}) {
  const seen = new Set<string>();
  const uniqueTasks = tasks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  return (
    <div
      className={cn(
        "rounded-xl border-2 min-h-[200px] p-3 transition-colors",
        COLUMN_COLORS[status]
      )}
    >
      <h3 className="font-semibold text-sm mb-3 capitalize flex items-center justify-between text-zinc-200">
        <span>{status.replace("_", " ")}</span>
        <span className="text-zinc-400 font-normal">{tasks.length}</span>
      </h3>
      <div className="space-y-2">
        {uniqueTasks.map((t) => (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => onTaskClick?.(t)}
            onKeyDown={(e) => {
              if (onTaskClick && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onTaskClick(t);
              }
            }}
            className={cn(onTaskClick && "cursor-pointer")}
          >
            <KanbanCard task={t} status={status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DroppableColumn({
  status,
  tasks,
  getCanAct,
  columnRef,
  onTaskClick,
}: {
  status: KanbanStatus;
  tasks: DashboardTask[];
  getCanAct: (t: DashboardTask) => boolean;
  columnRef?: (el: HTMLDivElement | null) => void;
  onTaskClick?: (task: DashboardTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        columnRef?.(el);
      }}
      className={cn(
        "rounded-xl border-2 min-h-[200px] p-3 transition-colors",
        COLUMN_COLORS[status],
        isOver && "ring-2 ring-white/50"
      )}
    >
      <h3 className="font-semibold text-sm mb-3 capitalize flex items-center justify-between text-zinc-200">
        <span>{status.replace("_", " ")}</span>
        <span className="text-zinc-400 font-normal">{tasks.length}</span>
      </h3>
      <div className="space-y-2">
        {(() => {
          const seen = new Set<string>();
          const uniqueTasks = tasks.filter((t) => {
            if (seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
          });
          return uniqueTasks.map((t) => (
            <DraggableKanbanCard
              key={t.id}
              task={t}
              status={status}
              canDrag={getCanAct(t) && (status === "PENDING" || status === "IN_PROGRESS")}
              onTaskClick={onTaskClick}
            />
          ));
        })()}
      </div>
    </div>
  );
}

export function DashboardProcessSection({
  allowedTemplates,
  tasks,
  currentUserId,
  isSuperOrAdmin,
}: {
  allowedTemplates: DashboardTemplate[];
  tasks: DashboardTask[];
  currentUserId: string;
  isSuperOrAdmin: boolean;
}) {
  const router = useRouter();
  const [tasksByStatus, setTasksByStatus] = useState<Record<KanbanStatus, DashboardTask[]>>(() => {
    const init: Record<string, DashboardTask[]> = {
      PENDING: [],
      IN_PROGRESS: [],
      APPROVED: [],
      REJECTED: [],
      SKIPPED: [],
    };
    for (const t of tasks) {
      const s = t.status as KanbanStatus;
      if (init[s]) init[s].push(t);
    }
    return init as Record<KanbanStatus, DashboardTask[]>;
  });
  const [startDialog, setStartDialog] = useState<{ open: boolean; templateId: string; templateName: string }>({
    open: false,
    templateId: "",
    templateName: "",
  });
  const [startLoading, setStartLoading] = useState(false);
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    task: DashboardTask;
    toStatus: "APPROVED" | "REJECTED";
    fromStatus: KanbanStatus;
  } | null>(null);
  const [taskComment, setTaskComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [snapBack, setSnapBack] = useState<{
    task: DashboardTask;
    fromStatus: KanbanStatus;
    toStatus: KanbanStatus;
    dropRect: DOMRect;
  } | null>(null);
  const [uploadedTaskId, setUploadedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<DashboardTask | null>(null);
  const [dndMounted, setDndMounted] = useState(false);
  const columnRefs = useRef<Record<KanbanStatus, HTMLDivElement | null>>({} as Record<KanbanStatus, HTMLDivElement | null>);
  const ghostRef = useRef<HTMLDivElement>(null);
  const lastDragEndTime = useRef(0);

  useEffect(() => {
    setDndMounted(true);
  }, []);

  useEffect(() => {
    const init: Record<string, DashboardTask[]> = {
      PENDING: [],
      IN_PROGRESS: [],
      APPROVED: [],
      REJECTED: [],
      SKIPPED: [],
    };
    const seenIds = new Set<string>();
    for (const t of tasks) {
      if (seenIds.has(t.id)) continue;
      seenIds.add(t.id);
      const s = t.status as KanbanStatus;
      if (init[s]) init[s].push(t);
    }
    setTasksByStatus(init as Record<KanbanStatus, DashboardTask[]>);
  }, [tasks]);

  const getCanAct = useCallback(
    (t: DashboardTask) =>
      isSuperOrAdmin || t.possibleAssignees.some((u) => u.id === currentUserId),
    [currentUserId, isSuperOrAdmin]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    if (!snapBack || !ghostRef.current) return;
    const sourceEl = columnRefs.current[snapBack.fromStatus];
    if (!sourceEl) {
      setSnapBack(null);
      return;
    }
    const sourceRect = sourceEl.getBoundingClientRect();
    gsap.to(ghostRef.current, {
      left: sourceRect.left,
      top: sourceRect.top,
      duration: 0.5,
      ease: "power2.out",
      onComplete: () => setSnapBack(null),
    });
  }, [snapBack]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      lastDragEndTime.current = Date.now();
      const { active, over } = event;
      if (!over) return;
      const task = active.data.current?.task as DashboardTask;
      const toColumn = String(over.id);
      if (!KANBAN_COLUMNS.includes(toColumn as KanbanStatus)) return;
      const toStatus = toColumn as KanbanStatus;
      const fromStatus = task.status as KanbanStatus;

      if (toStatus === fromStatus) return;

      if (toStatus === "APPROVED" || toStatus === "REJECTED") {
        setTasksByStatus((prev) => {
          const next = { ...prev };
          next[fromStatus] = next[fromStatus].filter((x) => x.id !== task.id);
          next[toStatus] = [...(next[toStatus] || []), { ...task, status: toStatus }];
          return next;
        });
        setActionModal({ open: true, task: { ...task, status: toStatus }, toStatus, fromStatus });
        return;
      }

      if (toStatus === "IN_PROGRESS" && fromStatus === "PENDING") {
        setActionLoading(true);
        try {
          await startTask(task.id);
          router.refresh();
        } catch (e) {
          console.error(e);
        } finally {
          setActionLoading(false);
        }
      }
    },
    [router]
  );

  const handleTaskClick = useCallback((task: DashboardTask) => {
    if (Date.now() - lastDragEndTime.current < 300) return;
    setSelectedTask(task);
  }, []);

  const handleStartSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStartLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("processTemplateId", startDialog.templateId);
    try {
      await startProcessInstance(formData);
      setStartDialog({ open: false, templateId: "", templateName: "" });
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setStartLoading(false);
    }
  };

  const taskInModal = actionModal?.task ?? selectedTask;

  const handleActionConfirm = useCallback(
    async (action: "APPROVED" | "REJECTED") => {
      if (!taskInModal) return;
      const task = taskInModal;
      if (action === "REJECTED" && (!taskComment.trim() || taskComment.replace(/<[^>]*>/g, "").trim() === "")) return;
      if (task.templateTask.needFile && !task.fileUrl && uploadedTaskId !== task.id) {
        setUploadError("File is required for this task.");
        return;
      }
      setActionLoading(true);
      setUploadError(null);
      try {
        if (action === "APPROVED") {
          await approveTask(task.id, taskComment.trim() || undefined);
        } else {
          await rejectTask(task.id, taskComment.trim() || taskComment);
        }
        setActionModal(null);
        setSelectedTask(null);
        setTaskComment("");
        setUploadedTaskId(null);
        router.refresh();
      } catch (err) {
        console.error(err);
      } finally {
        setActionLoading(false);
      }
    },
    [taskInModal, taskComment, uploadedTaskId, router]
  );

  const handleActionCancel = useCallback(() => {
    if (actionModal) {
      const { task, fromStatus, toStatus } = actionModal;
      const cardEl = document.querySelector(`[data-draggable-id="${task.id}"]`);
      if (cardEl) {
        const cardRect = cardEl.getBoundingClientRect();
        setSnapBack({ task, fromStatus, toStatus, dropRect: cardRect });
      }
      setTasksByStatus((prev) => {
        const next = { ...prev };
        next[toStatus] = next[toStatus].filter((x) => x.id !== task.id);
        next[fromStatus] = [...(next[fromStatus] || []), { ...task, status: fromStatus }];
        return next;
      });
      setActionModal(null);
      setTaskComment("");
      setUploadedTaskId(null);
    } else {
      setSelectedTask(null);
      setTaskComment("");
      setUploadedTaskId(null);
    }
  }, [actionModal]);

  const handleFileUpload = async (taskId: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData(form);
    try {
      const result = await uploadTaskFile(taskId, formData);
      if (result.ok) {
        form?.reset();
        setUploadedTaskId(taskId);
        router.refresh();
      } else {
        setUploadError(result.error);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {allowedTemplates.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Start a process</h2>
          <TooltipProvider>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {allowedTemplates.map((t, i) => {
                const colorClass = TEMPLATE_CARD_ICON_AND_TEXT[i % TEMPLATE_CARD_ICON_AND_TEXT.length];
                const displayName = t.name.length > 20 ? `${t.name.slice(0, 20)}…` : t.name;
                const tooltipContent = [t.name, t.description].filter(Boolean).join(t.description ? "\n\n" : "");
                const card = (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setStartDialog({
                        open: true,
                        templateId: t.id,
                        templateName: t.name,
                      })
                    }
                    className="rounded-xl border border-zinc-600 bg-zinc-800 p-3 transition-all hover:bg-zinc-700 hover:shadow-lg flex items-center gap-3 text-left w-full"
                  >
                    <div className={cn("shrink-0", colorClass)}>
                      <ProcessIcon icon={t.icon} className="size-6" />
                    </div>
                    <span className={cn("font-medium text-size-xs truncate min-w-0 flex-1", colorClass)}>
                      {displayName}
                    </span>
                  </button>
                );
                return tooltipContent ? (
                  <Tooltip key={t.id}>
                    <TooltipTrigger asChild>{card}</TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap">
                      {tooltipContent}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Fragment key={t.id}>{card}</Fragment>
                );
              })}
            </div>
          </TooltipProvider>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-200">Tasks by status</h2>
        {!dndMounted ? (
          <div className="rounded-xl bg-zinc-900/95 border border-zinc-700 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map((status) => (
              <StaticKanbanColumn
                key={status}
                status={status}
                tasks={tasksByStatus[status] || []}
                onTaskClick={handleTaskClick}
              />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragEnd={handleDragEnd}
          >
            <div className="rounded-xl bg-zinc-900/95 border border-zinc-700 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
              {KANBAN_COLUMNS.map((status) => (
                <DroppableColumn
                  key={status}
                  status={status}
                  tasks={tasksByStatus[status] || []}
                  getCanAct={getCanAct}
                  columnRef={(el) => {
                    columnRefs.current[status] = el;
                  }}
                  onTaskClick={handleTaskClick}
                />
              ))}
            </div>
          </DndContext>
        )}
      </section>

      {snapBack &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={ghostRef}
            id="kanban-snap-back-ghost"
            className="fixed z-[100] rounded-lg border bg-card p-3 shadow-lg will-change-[left,top]"
            style={{
              left: snapBack.dropRect.left,
              top: snapBack.dropRect.top,
              width: snapBack.dropRect.width,
              height: snapBack.dropRect.height,
            }}
          >
            <KanbanCard task={snapBack.task} status={snapBack.fromStatus} isGhost />
          </div>,
          document.body
        )}

      <Dialog open={startDialog.open} onOpenChange={(o) => !startLoading && setStartDialog((p) => ({ ...p, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start process: {startDialog.templateName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStartSubmit} className="space-y-4">
            <input type="hidden" name="processTemplateId" value={startDialog.templateId} />
            <div className="space-y-2">
              <Label>Instance name</Label>
              <Input
                name="name"
                defaultValue={`${startDialog.templateName} – ${new Date().toISOString().slice(0, 16)}`}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Start date & time</Label>
              <Input name="startDateTime" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStartDialog((p) => ({ ...p, open: false }))}>
                Cancel
              </Button>
              <Button type="submit" disabled={startLoading}>{startLoading ? "Starting..." : "Start"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!taskInModal} onOpenChange={(o) => !o && handleActionCancel()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {actionModal
                ? actionModal.toStatus === "APPROVED"
                  ? "Approve task"
                  : "Reject task"
                : "Task"}
            </DialogTitle>
          </DialogHeader>
          {taskInModal && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {taskInModal.templateTask.name} — {taskInModal.processInstance.name}
              </p>
              <div className="space-y-2">
                <Label>Comment (required for Reject)</Label>
                <RichTextComment
                  key={taskInModal.id}
                  value={taskComment}
                  onChange={setTaskComment}
                  minHeight="160px"
                />
              </div>
              {taskInModal.templateTask.needFile && (
                <div className="space-y-2">
                  <Label>File {taskInModal.fileUrl ? "(uploaded)" : "(required)"}</Label>
                  {taskInModal.fileUrl ? (
                    <a href={taskInModal.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                      View file
                    </a>
                  ) : (
                    <form onSubmit={(e) => handleFileUpload(taskInModal.id, e)} className="flex gap-2">
                      <input type="file" name="file" className="text-sm" required />
                      <Button type="submit" size="sm" disabled={uploading}>
                        {uploading ? "Uploading..." : "Upload"}
                      </Button>
                    </form>
                  )}
                </div>
              )}
              {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleActionCancel}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => handleActionConfirm("APPROVED")}
              disabled={
                actionLoading ||
                (taskInModal?.templateTask.needFile &&
                  !taskInModal?.fileUrl &&
                  uploadedTaskId !== taskInModal?.id)
              }
            >
              {actionLoading ? "Saving..." : "Approve"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleActionConfirm("REJECTED")}
              disabled={
                actionLoading ||
                !taskComment.trim() ||
                taskComment.replace(/<[^>]*>/g, "").trim() === "" ||
                (taskInModal?.templateTask.needFile &&
                  !taskInModal?.fileUrl &&
                  uploadedTaskId !== taskInModal?.id)
              }
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

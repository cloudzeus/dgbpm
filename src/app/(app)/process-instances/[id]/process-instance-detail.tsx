"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { taskStatusMeta } from "@/lib/process-status";
import { formatDateTime } from "@/lib/format";
import { Paperclip, User, Activity, ChevronRight, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextComment, CommentDisplay } from "@/components/rich-text-comment";
import { startTask, approveTask, rejectTask, uploadTaskFile } from "../actions";
import {
  TaskFieldsForm,
  type EditableField,
  type PriorField,
} from "@/components/process-fields/task-fields-form";

type Task = {
  id: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  comment: string | null;
  fileUrl: string | null;
  templateTask: {
    name: string;
    description: string | null;
    needFile: boolean;
    mandatory: boolean;
    order: number;
  };
  currentAssignee: { firstName: string; lastName: string } | null;
  possibleAssignees: { id: string }[];
  actions: {
    action: string;
    message: string | null;
    createdAt: Date;
    user: { firstName: string; lastName: string };
  }[];
};

type Instance = {
  id: string;
  status: string;
  tasks: Task[];
};

export function ProcessInstanceDetail({
  instance,
  currentUserId,
  isSuperOrAdmin,
  taskFields = {},
}: {
  instance: Instance;
  currentUserId: string;
  isSuperOrAdmin: boolean;
  taskFields?: Record<string, { editable: EditableField[]; readOnly: PriorField[] }>;
}) {
  const [taskModalId, setTaskModalId] = useState<string | null>(null);
  const [taskComment, setTaskComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const router = useRouter();

  const task = taskModalId ? instance.tasks.find((t) => t.id === taskModalId) : null;

  async function handleStart(taskId: string) {
    setLoading(true);
    try {
      await startTask(taskId);
      setTaskModalId(null);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(taskId: string) {
    setLoading(true);
    try {
      await approveTask(taskId, taskComment.trim() || undefined);
      setTaskModalId(null);
      setTaskComment("");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(taskId: string) {
    if (!taskComment.trim()) return;
    setLoading(true);
    try {
      await rejectTask(taskId, taskComment);
      setTaskComment("");
      setTaskModalId(null);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(taskId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setUploadError(null);
    setUploading(true);
    try {
      const result = await uploadTaskFile(taskId, formData);
      if (result.ok) {
        form?.reset();
        router.refresh();
      } else {
        setUploadError(result.error);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <ol className="relative max-w-3xl">
        {[...instance.tasks]
          .sort((a, b) => a.templateTask.order - b.templateTask.order)
          .map((t, idx, arr) => {
            const meta = taskStatusMeta(t.status);
            const isLast = idx === arr.length - 1;
            const isActive = t.status === "IN_PROGRESS";
            const isResolved = t.status === "APPROVED" || t.status === "SKIPPED";
            // Μπλοκαρισμένο: μη ολοκληρωμένο βήμα με εκκρεμές προηγούμενο (σειριακή ροή).
            const blocked =
              !isResolved &&
              t.status !== "REJECTED" &&
              arr
                .slice(0, idx)
                .some((p) => p.status !== "APPROVED" && p.status !== "SKIPPED");
            const Icon = meta.Icon;
            const open = () => {
              setTaskModalId(t.id);
              setTaskComment("");
            };
            return (
              <li key={t.id} className="relative flex gap-3 pb-4 last:pb-0">
                {/* connector — centered on the 32px node (center x = 16px) */}
                {!isLast && (
                  <span
                    className={`absolute left-4 top-8 bottom-0 w-0.5 -translate-x-1/2 ${
                      isResolved ? "bg-emerald-500" : "bg-border"
                    }`}
                    aria-hidden
                  />
                )}
                {/* node */}
                <div
                  className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors ${
                    blocked
                      ? "border-dashed border-border bg-muted text-muted-foreground/60"
                      : meta.node
                  } ${isActive ? "ring-4 ring-blue-500/15" : ""}`}
                >
                  {blocked ? (
                    <Lock className="size-3.5" />
                  ) : isResolved || t.status === "REJECTED" ? (
                    <Icon className="size-4" />
                  ) : (
                    t.templateTask.order + 1
                  )}
                </div>

                {/* content — flat, clickable, no card border */}
                <button
                  type="button"
                  onClick={open}
                  className="group -mt-1 min-w-0 flex-1 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* title row */}
                  <div className="flex items-center gap-2">
                    <span className="ui-meta shrink-0 tabular-nums">
                      {t.templateTask.order + 1}.
                    </span>
                    <span
                      className={`truncate text-sm font-medium ${
                        isResolved || blocked ? "text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {t.templateTask.name}
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                    <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                  </div>

                  {/* meta line: assignee · last action · requirement chips */}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 ui-meta">
                    <span className="flex min-w-0 items-center gap-1">
                      <User className="size-3 shrink-0 text-muted-foreground/50" />
                      <span className="truncate">
                        {t.currentAssignee
                          ? `${t.currentAssignee.firstName} ${t.currentAssignee.lastName}`
                          : "Χωρίς υπεύθυνο"}
                      </span>
                    </span>
                    {t.actions[0] && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="flex min-w-0 items-center gap-1">
                          <Activity className="size-3 shrink-0 text-muted-foreground/50" />
                          <span className="truncate">
                            {t.actions[0].action} · {t.actions[0].user.firstName}{" "}
                            {t.actions[0].user.lastName}
                          </span>
                        </span>
                      </>
                    )}
                    {t.templateTask.mandatory && (
                      <span className="text-muted-foreground/70">· Υποχρεωτικό</span>
                    )}
                    {t.templateTask.needFile && (
                      <span className="flex items-center gap-1 text-muted-foreground/70">
                        · <Paperclip className="size-3" /> Αρχείο
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
      </ol>

      <Dialog open={!!taskModalId} onOpenChange={() => setTaskModalId(null)}>
        <DialogContent className="max-w-2xl gap-0 p-0">
          {task && (() => {
            const canAct =
              (isSuperOrAdmin ||
                task.possibleAssignees.some((u) => u.id === currentUserId)) &&
              task.status !== "APPROVED" &&
              task.status !== "REJECTED";
            const meta = taskStatusMeta(task.status);
            // Σειριακή ροή: κλείδωμα ενεργειών όσο εκκρεμεί προηγούμενο βήμα.
            const priorBlocking = instance.tasks
              .filter((x) => x.templateTask.order < task.templateTask.order)
              .sort((a, b) => a.templateTask.order - b.templateTask.order)
              .find((x) => x.status !== "APPROVED" && x.status !== "SKIPPED");
            const locked = !!priorBlocking;
            return (
              <>
                {/* header */}
                <DialogHeader className="gap-2 border-b px-6 py-4 text-left">
                  <div className="flex items-center gap-2">
                    <span className="ui-eyebrow tabular-nums">
                      Βήμα {task.templateTask.order + 1}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <DialogTitle>{task.templateTask.name}</DialogTitle>
                  {task.templateTask.description && (
                    <DialogDescription>{task.templateTask.description}</DialogDescription>
                  )}
                  {(task.templateTask.mandatory || task.templateTask.needFile) && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {task.templateTask.mandatory && (
                        <Badge variant="outline" className="text-xs">Υποχρεωτικό</Badge>
                      )}
                      {task.templateTask.needFile && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Paperclip className="size-3" /> Απαιτείται αρχείο
                        </Badge>
                      )}
                    </div>
                  )}
                </DialogHeader>

                {/* body */}
                <div className="space-y-5 px-6 py-5">
                  {/* overview — always visible so the step is never a mystery */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-3">
                    <div>
                      <div className="ui-eyebrow">Υπεύθυνος</div>
                      <div className="mt-0.5 truncate text-sm">
                        {task.currentAssignee
                          ? `${task.currentAssignee.firstName} ${task.currentAssignee.lastName}`
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="ui-eyebrow">Έναρξη</div>
                      <div className="mt-0.5 text-sm tabular-nums">
                        {task.startedAt ? formatDateTime(task.startedAt) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="ui-eyebrow">Ολοκλήρωση</div>
                      <div className="mt-0.5 text-sm tabular-nums">
                        {task.completedAt ? formatDateTime(task.completedAt) : "—"}
                      </div>
                    </div>
                  </div>

                  {taskFields[task.id] &&
                    (taskFields[task.id].editable.length > 0 ||
                      taskFields[task.id].readOnly.length > 0) && (
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <TaskFieldsForm
                          taskId={task.id}
                          editable={taskFields[task.id].editable}
                          readOnly={taskFields[task.id].readOnly}
                          canEdit={canAct}
                        />
                      </div>
                    )}

                  {task.status === "REJECTED" && task.comment && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                      <h4 className="ui-eyebrow mb-1.5 text-destructive">Λόγος απόρριψης</h4>
                      <CommentDisplay content={task.comment} />
                    </div>
                  )}
                  {task.status === "APPROVED" && task.comment && (
                    <div className="rounded-lg border bg-muted/40 p-4">
                      <h4 className="ui-eyebrow mb-1.5">Σχόλιο έγκρισης</h4>
                      <CommentDisplay content={task.comment} />
                    </div>
                  )}

                  {canAct && !locked && (
                    <section className="space-y-2">
                      <div>
                        <h4 className="ui-eyebrow">Σχόλιο</h4>
                        <p className="ui-meta mt-0.5">
                          Υποχρεωτικό στην απόρριψη, προαιρετικό στην έγκριση.
                        </p>
                      </div>
                      <RichTextComment
                        key={taskModalId ?? "modal"}
                        value={taskComment}
                        onChange={setTaskComment}
                        minHeight="180px"
                      />
                    </section>
                  )}

                  {task.templateTask.needFile && (
                    <section className="space-y-2">
                      <h4 className="ui-eyebrow">Συνημμένο αρχείο</h4>
                      {task.fileUrl ? (
                        <a
                          href={task.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                          <Paperclip className="size-3.5" /> Προβολή αρχείου
                        </a>
                      ) : (
                        <p className="ui-body-muted">Δεν έχει μεταφορτωθεί αρχείο ακόμη.</p>
                      )}
                      {canAct && (
                        <form
                          onSubmit={(e) => handleFileUpload(task.id, e)}
                          className="flex flex-wrap items-center gap-2 pt-1"
                        >
                          <input
                            type="file"
                            name="file"
                            className="text-sm file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-primary-foreground"
                          />
                          <Button type="submit" variant="outline" size="sm" disabled={uploading}>
                            {uploading ? "Μεταφόρτωση..." : "Μεταφόρτωση"}
                          </Button>
                          {uploadError && (
                            <p className="w-full text-sm text-destructive">{uploadError}</p>
                          )}
                        </form>
                      )}
                    </section>
                  )}

                  <section className="space-y-2">
                    <h4 className="ui-eyebrow">Ιστορικό</h4>
                    {task.actions.length === 0 ? (
                      <p className="ui-body-muted">Καμία ενέργεια ακόμη.</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {task.actions.map((a) => (
                          <li key={a.createdAt.toString()} className="flex gap-3 text-sm">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                            <div className="min-w-0">
                              <div>
                                <span className="font-medium">{a.action}</span>{" "}
                                <span className="text-muted-foreground">
                                  · {a.user.firstName} {a.user.lastName}
                                </span>
                              </div>
                              {a.message && (
                                <div className="ui-body-muted">
                                  <CommentDisplay content={a.message} inline />
                                </div>
                              )}
                              <div className="ui-meta mt-0.5 tabular-nums">
                                {formatDateTime(a.createdAt)}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>

                {/* footer */}
                {canAct &&
                  (task.status === "PENDING" || task.status === "IN_PROGRESS") &&
                  (locked ? (
                    <div className="flex items-center gap-2 border-t bg-muted/20 px-6 py-4 text-sm text-muted-foreground">
                      <Lock className="size-4 shrink-0" />
                      <span>
                        Ολοκληρώστε πρώτα το προηγούμενο βήμα{" "}
                        <span className="font-medium text-foreground">
                          «{priorBlocking!.templateTask.name}» (Βήμα{" "}
                          {priorBlocking!.templateTask.order + 1})
                        </span>
                        .
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-4">
                      {task.status === "PENDING" && (
                        <Button
                          variant="outline"
                          onClick={() => handleStart(task.id)}
                          disabled={loading}
                        >
                          Έναρξη εργασίας
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={() => handleReject(task.id)}
                        disabled={
                          loading ||
                          !taskComment.trim() ||
                          taskComment.replace(/<[^>]*>/g, "").trim() === ""
                        }
                      >
                        Απόρριψη
                      </Button>
                      <Button onClick={() => handleApprove(task.id)} disabled={loading}>
                        Έγκριση
                      </Button>
                    </div>
                  ))}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { taskStatusMeta } from "@/lib/process-status";
import { formatDateTime } from "@/lib/format";
import { Paperclip } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextComment, CommentDisplay } from "@/components/rich-text-comment";
import { startTask, approveTask, rejectTask, uploadTaskFile } from "../actions";

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
}: {
  instance: Instance;
  currentUserId: string;
  isSuperOrAdmin: boolean;
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
      <ol className="relative">
        {[...instance.tasks]
          .sort((a, b) => a.templateTask.order - b.templateTask.order)
          .map((t, idx, arr) => {
            const meta = taskStatusMeta(t.status);
            const isLast = idx === arr.length - 1;
            const Icon = meta.Icon;
            return (
              <li key={t.id} className="relative flex gap-4 pb-4 last:pb-0">
                {/* connector line */}
                {!isLast && (
                  <span
                    className="absolute left-[15px] top-8 bottom-0 w-px bg-border"
                    aria-hidden
                  />
                )}
                {/* status node */}
                <div
                  className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ${meta.node} ${
                    t.status === "IN_PROGRESS" ? "ring-4 ring-blue-500/15" : ""
                  }`}
                >
                  <Icon className="size-4" />
                </div>

                {/* card */}
                <div className="flex-1 min-w-0 rounded-lg border bg-card p-3 hover:border-primary/40 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          Βήμα {t.templateTask.order + 1}
                        </span>
                        <span className="font-medium">{t.templateTask.name}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}
                        >
                          {meta.label}
                        </span>
                        {t.templateTask.mandatory && (
                          <Badge variant="outline" className="text-xs">Υποχρεωτικό</Badge>
                        )}
                        {t.templateTask.needFile && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Paperclip className="size-3" /> Αρχείο
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTaskModalId(t.id);
                        setTaskComment("");
                      }}
                    >
                      Άνοιγμα
                    </Button>
                  </div>

                  <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="truncate">
                      <span className="text-muted-foreground/70">Υπεύθυνος: </span>
                      {t.currentAssignee
                        ? `${t.currentAssignee.firstName} ${t.currentAssignee.lastName}`
                        : "—"}
                    </div>
                    <div className="truncate">
                      <span className="text-muted-foreground/70">Τελευταία ενέργεια: </span>
                      {t.actions[0]
                        ? `${t.actions[0].action} · ${t.actions[0].user.firstName} ${t.actions[0].user.lastName}`
                        : "—"}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
      </ol>

      <Dialog open={!!taskModalId} onOpenChange={() => setTaskModalId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{task?.templateTask.name}</DialogTitle>
          </DialogHeader>
          {task && (
            <div className="space-y-4">
              {task.templateTask.description && (
                <p className="text-sm text-muted-foreground">{task.templateTask.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {task.templateTask.mandatory && (
                  <Badge variant="success">Υποχρεωτικό</Badge>
                )}
                {task.templateTask.needFile && (
                  <Badge variant="info">Απαιτείται αρχείο</Badge>
                )}
              </div>

              {(task.status === "REJECTED" && task.comment) && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <h4 className="text-sm font-semibold text-destructive mb-1">Λόγος απόρριψης</h4>
                  <CommentDisplay content={task.comment} />
                </div>
              )}
              {(task.status === "APPROVED" && task.comment) && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <h4 className="text-sm font-semibold text-foreground mb-1">Σχόλιο έγκρισης</h4>
                  <CommentDisplay content={task.comment} />
                </div>
              )}

              {(isSuperOrAdmin || task.possibleAssignees.some((u) => u.id === currentUserId)) &&
                task.status !== "APPROVED" &&
                task.status !== "REJECTED" && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Σχόλιο</h4>
                    <p className="text-muted-foreground text-xs">Προσθέστε σχόλιο (υποχρεωτικό στην απόρριψη, προαιρετικό στην έγκριση).</p>
                    <RichTextComment
                      key={taskModalId ?? "modal"}
                      value={taskComment}
                      onChange={setTaskComment}
                      minHeight="280px"
                    />
                  </div>
                )}

              {task.templateTask.needFile && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Συνημμένο αρχείο</h4>
                  {task.fileUrl ? (
                    <p className="text-sm">
                      <a
                        href={task.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Προβολή αρχείου
                      </a>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Δεν έχει μεταφορτωθεί αρχείο ακόμη.</p>
                  )}
                  {(isSuperOrAdmin || task.possibleAssignees.some((u) => u.id === currentUserId)) &&
                    task.status !== "APPROVED" &&
                    task.status !== "REJECTED" && (
                      <form
                        onSubmit={(e) => handleFileUpload(task.id, e)}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input
                          type="file"
                          name="file"
                          className="text-sm file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-sm"
                        />
                        <Button type="submit" variant="outline" size="sm" disabled={uploading}>
                          {uploading ? "Μεταφόρτωση..." : "Μεταφόρτωση"}
                        </Button>
                        {uploadError && (
                          <p className="w-full text-sm text-destructive">{uploadError}</p>
                        )}
                      </form>
                    )}
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium mb-2">Ιστορικό</h4>
                <ul className="space-y-1 text-sm">
                  {task.actions.map((a) => (
                    <li key={a.createdAt.toString()}>
                      {a.action} από {a.user.firstName} {a.user.lastName}
                      {a.message && (
                        <>
                          : <CommentDisplay content={a.message} inline />
                        </>
                      )}{" "}
                      — {formatDateTime(a.createdAt)}
                    </li>
                  ))}
                  {task.actions.length === 0 && <li className="text-muted-foreground">Καμία ενέργεια ακόμη</li>}
                </ul>
              </div>

              {(isSuperOrAdmin || task.possibleAssignees.some((u) => u.id === currentUserId)) && task.status !== "APPROVED" && task.status !== "REJECTED" && (
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {task.status === "PENDING" && (
                    <Button
                      onClick={() => handleStart(task.id)}
                      disabled={loading}
                    >
                      Έναρξη εργασίας
                    </Button>
                  )}
                  {(task.status === "PENDING" || task.status === "IN_PROGRESS") && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="default"
                          onClick={() => handleApprove(task.id)}
                          disabled={loading}
                        >
                          Έγκριση
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleReject(task.id)}
                          disabled={loading || !taskComment.trim() || taskComment.replace(/<[^>]*>/g, "").trim() === ""}
                        >
                          Απόρριψη (απαιτείται σχόλιο)
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

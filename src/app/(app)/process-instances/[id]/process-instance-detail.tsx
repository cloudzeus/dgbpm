"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextComment, CommentDisplay } from "@/components/rich-text-comment";
import { startTask, approveTask, rejectTask, uploadTaskFile } from "../actions";
import { ProcessIcon } from "@/lib/process-icons";

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
        form.reset();
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Last action</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instance.tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.templateTask.order + 1}</TableCell>
                <TableCell>
                  <div className="font-medium">{t.templateTask.name}</div>
                  {t.templateTask.mandatory && (
                    <Badge variant="success" className="mr-1 text-xs">Mandatory</Badge>
                  )}
                  {t.templateTask.needFile && (
                    <Badge variant="info" className="text-xs">File required</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      t.status === "APPROVED"
                        ? "success"
                        : t.status === "REJECTED"
                          ? "destructive"
                          : t.status === "IN_PROGRESS"
                            ? "info"
                            : "warning"
                    }
                  >
                    {t.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {t.currentAssignee
                    ? `${t.currentAssignee.firstName} ${t.currentAssignee.lastName}`
                    : "—"}
                </TableCell>
                <TableCell>
                  {t.actions[0]
                    ? `${t.actions[0].action} by ${t.actions[0].user.firstName} ${t.actions[0].user.lastName}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTaskModalId(t.id);
                      setTaskComment("");
                    }}
                  >
                    Open task
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
                  <Badge variant="success">Mandatory</Badge>
                )}
                {task.templateTask.needFile && (
                  <Badge variant="info">File required</Badge>
                )}
              </div>

              {(task.status === "REJECTED" && task.comment) && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <h4 className="text-sm font-semibold text-destructive mb-1">Rejection reason</h4>
                  <CommentDisplay content={task.comment} />
                </div>
              )}
              {(task.status === "APPROVED" && task.comment) && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <h4 className="text-sm font-semibold text-foreground mb-1">Approval comment</h4>
                  <CommentDisplay content={task.comment} />
                </div>
              )}

              {(isSuperOrAdmin || task.possibleAssignees.some((u) => u.id === currentUserId)) &&
                task.status !== "APPROVED" &&
                task.status !== "REJECTED" && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Comment</h4>
                    <p className="text-muted-foreground text-xs">Add a comment (required when rejecting). Optional when approving.</p>
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
                  <h4 className="text-sm font-medium">Attached file</h4>
                  {task.fileUrl ? (
                    <p className="text-sm">
                      <a
                        href={task.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        View file
                      </a>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No file uploaded yet.</p>
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
                          {uploading ? "Uploading..." : "Upload"}
                        </Button>
                        {uploadError && (
                          <p className="w-full text-sm text-destructive">{uploadError}</p>
                        )}
                      </form>
                    )}
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium mb-2">History</h4>
                <ul className="space-y-1 text-sm">
                  {task.actions.map((a) => (
                    <li key={a.createdAt.toString()}>
                      {a.action} by {a.user.firstName} {a.user.lastName}
                      {a.message && (
                        <>
                          : <CommentDisplay content={a.message} inline />
                        </>
                      )}{" "}
                      — {new Date(a.createdAt).toLocaleString()}
                    </li>
                  ))}
                  {task.actions.length === 0 && <li className="text-muted-foreground">No actions yet</li>}
                </ul>
              </div>

              {(isSuperOrAdmin || task.possibleAssignees.some((u) => u.id === currentUserId)) && task.status !== "APPROVED" && task.status !== "REJECTED" && (
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {task.status === "PENDING" && (
                    <Button
                      onClick={() => handleStart(task.id)}
                      disabled={loading}
                    >
                      Start task
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
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleReject(task.id)}
                          disabled={loading || !taskComment.trim() || taskComment.replace(/<[^>]*>/g, "").trim() === ""}
                        >
                          Reject (comment required)
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

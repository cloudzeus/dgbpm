import {
  CheckCircle2,
  XCircle,
  Clock,
  Circle,
  MinusCircle,
  type LucideIcon,
} from "lucide-react";

export type TaskTone = "done" | "rejected" | "active" | "skipped" | "pending";

type TaskStatusMeta = {
  label: string;
  tone: TaskTone;
  Icon: LucideIcon;
  /** solid dot / node color */
  dot: string;
  /** node background + text when filled */
  node: string;
  /** soft badge (bg + text) */
  badge: string;
};

const TASK_STATUS: Record<string, TaskStatusMeta> = {
  APPROVED: {
    label: "Εγκρίθηκε",
    tone: "done",
    Icon: CheckCircle2,
    dot: "bg-emerald-500",
    node: "bg-emerald-500 text-white border-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  REJECTED: {
    label: "Απορρίφθηκε",
    tone: "rejected",
    Icon: XCircle,
    dot: "bg-destructive",
    node: "bg-destructive text-white border-destructive",
    badge: "bg-destructive/10 text-destructive",
  },
  IN_PROGRESS: {
    label: "Σε εξέλιξη",
    tone: "active",
    Icon: Clock,
    dot: "bg-blue-500",
    node: "bg-blue-500 text-white border-blue-500",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  SKIPPED: {
    label: "Παραλείφθηκε",
    tone: "skipped",
    Icon: MinusCircle,
    dot: "bg-muted-foreground/40",
    node: "bg-muted text-muted-foreground border-border",
    badge: "bg-muted text-muted-foreground",
  },
  PENDING: {
    label: "Σε αναμονή",
    tone: "pending",
    Icon: Circle,
    dot: "bg-amber-500",
    node: "bg-background text-muted-foreground border-amber-500/60",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
  },
};

export function taskStatusMeta(status: string): TaskStatusMeta {
  return TASK_STATUS[status] ?? TASK_STATUS.PENDING;
}

/** Humanized instance status → Badge variant */
export function instanceStatusMeta(status: string): {
  label: string;
  variant: "success" | "destructive" | "info" | "secondary";
  dot: string;
} {
  switch (status) {
    case "COMPLETED":
      return { label: "Ολοκληρώθηκε", variant: "success", dot: "bg-emerald-500" };
    case "CANCELLED":
      return { label: "Ακυρώθηκε", variant: "destructive", dot: "bg-destructive" };
    case "RUNNING":
      return { label: "Σε εξέλιξη", variant: "info", dot: "bg-blue-500" };
    default:
      return {
        label: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " "),
        variant: "secondary",
        dot: "bg-muted-foreground",
      };
  }
}

/** Progress across a set of tasks (skipped counts as resolved). */
export function taskProgress(tasks: { status: string }[]) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "APPROVED" || t.status === "SKIPPED").length;
  const rejected = tasks.some((t) => t.status === "REJECTED");
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, rejected, pct };
}

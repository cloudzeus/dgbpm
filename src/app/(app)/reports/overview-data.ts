"use server";

import { prisma } from "@/lib/prisma";
import { computeDelay, daysBetween, DEFAULT_SLA_DAYS } from "@/lib/sla";

export type OverviewKpis = {
  totalInstances: number;
  running: number;
  completed: number;
  cancelled: number;
  completionRatePct: number;
  avgCompletionDays: number | null;
  rejectionRatePct: number;
  activeTasks: number;
  overdueTasks: number;
  atRiskTasks: number;
  overdueInstances: number;
};

export type DelayedItem = {
  instanceId: string;
  instanceName: string;
  templateName: string;
  stepName: string;
  order: number;
  status: string;
  assigneeName: string | null;
  ageDays: number;
  overdueDays: number;
  dueAt: string;
  severity: "overdue" | "atrisk";
};

export type Bottleneck = {
  templateTaskId: string;
  stepName: string;
  templateName: string;
  activeCount: number;
  overdueCount: number;
  avgProcessingDays: number | null;
  rejectionRatePct: number;
  totalHandled: number;
};

export type WorkloadUser = {
  userId: string;
  userName: string;
  role: string;
  pending: number;
  inProgress: number;
  overdue: number;
  total: number;
};

export type WorkloadDept = {
  departmentId: string;
  name: string;
  color: string;
  pending: number;
  inProgress: number;
  overdue: number;
};

export type TrendPoint = {
  month: string;
  label: string;
  started: number;
  completed: number;
};

export type OverviewData = {
  kpis: OverviewKpis;
  delayed: DelayedItem[];
  bottlenecks: Bottleneck[];
  workloadUsers: WorkloadUser[];
  workloadDepts: WorkloadDept[];
  trends: TrendPoint[];
  defaultSlaDays: number;
};

const GR_MONTHS = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μάι", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"];

function fullName(u: { firstName: string; lastName: string } | null): string | null {
  if (!u) return null;
  return `${u.firstName} ${u.lastName}`.trim() || null;
}

export async function getOverviewData(): Promise<OverviewData> {
  const now = new Date();

  const [instances, assignments, users] = await Promise.all([
    prisma.processInstance.findMany({
      select: { id: true, status: true, startDateTime: true, endDateTime: true },
    }),
    prisma.processTaskAssignment.findMany({
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        currentAssigneeId: true,
        currentAssignee: { select: { firstName: true, lastName: true } },
        processInstance: {
          select: { id: true, name: true, status: true, startDateTime: true },
        },
        templateTask: {
          select: {
            id: true,
            name: true,
            order: true,
            slaDays: true,
            processTemplate: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        positions: {
          select: { position: { select: { department: { select: { id: true, name: true, color: true } } } } },
        },
      },
    }),
  ]);

  // ---------- KPIs ----------
  const running = instances.filter((i) => i.status === "RUNNING").length;
  const completed = instances.filter((i) => i.status === "COMPLETED").length;
  const cancelled = instances.filter((i) => i.status === "CANCELLED").length;
  const finished = completed + cancelled;
  const completionRatePct = finished === 0 ? 0 : Math.round((completed / finished) * 100);

  const completedDurations = instances
    .filter((i) => i.status === "COMPLETED" && i.endDateTime)
    .map((i) => daysBetween(i.startDateTime, i.endDateTime as Date));
  const avgCompletionDays =
    completedDurations.length === 0
      ? null
      : Math.round((completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length) * 10) / 10;

  const decided = assignments.filter((t) => t.status === "APPROVED" || t.status === "REJECTED");
  const rejectedCount = assignments.filter((t) => t.status === "REJECTED").length;
  const rejectionRatePct = decided.length === 0 ? 0 : Math.round((rejectedCount / decided.length) * 100);

  // ---------- Active tasks / delays ----------
  const activeTasks = assignments.filter(
    (t) =>
      (t.status === "PENDING" || t.status === "IN_PROGRESS") &&
      t.processInstance.status === "RUNNING",
  );

  const delayed: DelayedItem[] = [];
  const overdueInstanceIds = new Set<string>();
  let overdueTasks = 0;
  let atRiskTasks = 0;

  for (const t of activeTasks) {
    const clockStart = t.startedAt ?? t.processInstance.startDateTime;
    const d = computeDelay(clockStart, t.templateTask.slaDays, now);
    if (d.isOverdue) {
      overdueTasks++;
      overdueInstanceIds.add(t.processInstance.id);
    } else if (d.isAtRisk) {
      atRiskTasks++;
    }
    if (d.isOverdue || d.isAtRisk) {
      delayed.push({
        instanceId: t.processInstance.id,
        instanceName: t.processInstance.name,
        templateName: t.templateTask.processTemplate.name,
        stepName: t.templateTask.name,
        order: t.templateTask.order + 1,
        status: t.status,
        assigneeName: fullName(t.currentAssignee),
        ageDays: d.ageDays,
        overdueDays: d.overdueDays,
        dueAt: d.dueAt.toISOString(),
        severity: d.isOverdue ? "overdue" : "atrisk",
      });
    }
  }
  delayed.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "overdue" ? -1 : 1;
    return b.overdueDays - a.overdueDays || b.ageDays - a.ageDays;
  });

  const kpis: OverviewKpis = {
    totalInstances: instances.length,
    running,
    completed,
    cancelled,
    completionRatePct,
    avgCompletionDays,
    rejectionRatePct,
    activeTasks: activeTasks.length,
    overdueTasks,
    atRiskTasks,
    overdueInstances: overdueInstanceIds.size,
  };

  // ---------- Bottlenecks per step ----------
  const bmap = new Map<
    string,
    {
      stepName: string;
      templateName: string;
      activeCount: number;
      overdueCount: number;
      procDays: number[];
      approved: number;
      rejected: number;
    }
  >();
  for (const t of assignments) {
    const key = t.templateTask.id;
    let row = bmap.get(key);
    if (!row) {
      row = {
        stepName: t.templateTask.name,
        templateName: t.templateTask.processTemplate.name,
        activeCount: 0,
        overdueCount: 0,
        procDays: [],
        approved: 0,
        rejected: 0,
      };
      bmap.set(key, row);
    }
    if (t.status === "APPROVED") row.approved++;
    if (t.status === "REJECTED") row.rejected++;
    if (t.startedAt && t.completedAt) row.procDays.push(daysBetween(t.startedAt, t.completedAt));
    if (
      (t.status === "PENDING" || t.status === "IN_PROGRESS") &&
      t.processInstance.status === "RUNNING"
    ) {
      row.activeCount++;
      const d = computeDelay(t.startedAt ?? t.processInstance.startDateTime, t.templateTask.slaDays, now);
      if (d.isOverdue) row.overdueCount++;
    }
  }
  const bottlenecks: Bottleneck[] = Array.from(bmap.entries())
    .map(([id, v]) => {
      const totalDecided = v.approved + v.rejected;
      return {
        templateTaskId: id,
        stepName: v.stepName,
        templateName: v.templateName,
        activeCount: v.activeCount,
        overdueCount: v.overdueCount,
        avgProcessingDays:
          v.procDays.length === 0
            ? null
            : Math.round((v.procDays.reduce((a, b) => a + b, 0) / v.procDays.length) * 10) / 10,
        rejectionRatePct: totalDecided === 0 ? 0 : Math.round((v.rejected / totalDecided) * 100),
        totalHandled: v.approved + v.rejected + v.activeCount,
      };
    })
    .sort(
      (a, b) =>
        b.overdueCount - a.overdueCount ||
        (b.avgProcessingDays ?? 0) - (a.avgProcessingDays ?? 0) ||
        b.activeCount - a.activeCount,
    );

  // ---------- Workload per user + department ----------
  const userDepts = new Map<string, { id: string; name: string; color: string }[]>();
  const userMeta = new Map<string, { name: string; role: string }>();
  for (const u of users) {
    userMeta.set(u.id, { name: `${u.firstName} ${u.lastName}`.trim(), role: u.role });
    const depts = new Map<string, { id: string; name: string; color: string }>();
    for (const p of u.positions) {
      const dpt = p.position.department;
      if (dpt) depts.set(dpt.id, dpt);
    }
    userDepts.set(u.id, Array.from(depts.values()));
  }

  const uwMap = new Map<string, { pending: number; inProgress: number; overdue: number }>();
  const dwMap = new Map<string, { name: string; color: string; pending: number; inProgress: number; overdue: number }>();

  for (const t of activeTasks) {
    const uid = t.currentAssigneeId;
    if (!uid) continue;
    const d = computeDelay(t.startedAt ?? t.processInstance.startDateTime, t.templateTask.slaDays, now);
    const isOverdue = d.isOverdue;

    let uw = uwMap.get(uid);
    if (!uw) {
      uw = { pending: 0, inProgress: 0, overdue: 0 };
      uwMap.set(uid, uw);
    }
    if (t.status === "PENDING") uw.pending++;
    else uw.inProgress++;
    if (isOverdue) uw.overdue++;

    for (const dpt of userDepts.get(uid) ?? []) {
      let dw = dwMap.get(dpt.id);
      if (!dw) {
        dw = { name: dpt.name, color: dpt.color, pending: 0, inProgress: 0, overdue: 0 };
        dwMap.set(dpt.id, dw);
      }
      if (t.status === "PENDING") dw.pending++;
      else dw.inProgress++;
      if (isOverdue) dw.overdue++;
    }
  }

  const workloadUsers: WorkloadUser[] = Array.from(uwMap.entries())
    .map(([userId, v]) => ({
      userId,
      userName: userMeta.get(userId)?.name || "—",
      role: userMeta.get(userId)?.role || "",
      pending: v.pending,
      inProgress: v.inProgress,
      overdue: v.overdue,
      total: v.pending + v.inProgress,
    }))
    .sort((a, b) => b.overdue - a.overdue || b.total - a.total);

  const workloadDepts: WorkloadDept[] = Array.from(dwMap.entries())
    .map(([departmentId, v]) => ({
      departmentId,
      name: v.name,
      color: v.color,
      pending: v.pending,
      inProgress: v.inProgress,
      overdue: v.overdue,
    }))
    .sort((a, b) => b.overdue - a.overdue || b.pending + b.inProgress - (a.pending + a.inProgress));

  // ---------- Trends (last 6 months) ----------
  const trends: TrendPoint[] = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const month = `${y}-${String(m + 1).padStart(2, "0")}`;
    const started = instances.filter(
      (i) => i.startDateTime.getFullYear() === y && i.startDateTime.getMonth() === m,
    ).length;
    const completedCount = instances.filter(
      (i) =>
        i.status === "COMPLETED" &&
        i.endDateTime &&
        i.endDateTime.getFullYear() === y &&
        i.endDateTime.getMonth() === m,
    ).length;
    trends.push({ month, label: GR_MONTHS[m], started, completed: completedCount });
  }

  return { kpis, delayed, bottlenecks, workloadUsers, workloadDepts, trends, defaultSlaDays: DEFAULT_SLA_DAYS };
}

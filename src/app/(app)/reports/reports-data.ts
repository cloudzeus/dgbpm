"use server";

import { prisma } from "@/lib/prisma";

/** Report 1: Processes by User */
export type ReportByUserRow = {
  userId: string;
  userName: string;
  email: string;
  role: string;
  processesStarted: number;
  tasksAssigned: number;
  tasksApproved: number;
  tasksRejected: number;
  tasksInProgress: number;
  tasksPending: number;
};

export async function getReportByUserData(): Promise<ReportByUserRow[]> {
  const users = await prisma.user.findMany({
    where: { role: { not: undefined } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      processesStarted: { select: { id: true } },
      taskAssignments: { select: { taskId: true } },
      currentAssigneeTasks: {
        select: {
          id: true,
          status: true,
          processInstance: { select: { id: true } },
        },
      },
      taskActions: {
        select: { action: true },
      },
    },
  });

  const rows: ReportByUserRow[] = users.map((u) => {
    const processesStarted = u.processesStarted.length;
    const tasksAssigned = u.taskAssignments.length;
    const approved = u.taskActions.filter((a) => a.action === "APPROVE").length;
    const rejected = u.taskActions.filter((a) => a.action === "REJECT").length;
    const inProgress = u.currentAssigneeTasks.filter((t) => t.status === "IN_PROGRESS").length;
    const pending = u.currentAssigneeTasks.filter((t) => t.status === "PENDING").length;
    return {
      userId: u.id,
      userName: `${u.firstName} ${u.lastName}`.trim() || u.email,
      email: u.email,
      role: u.role,
      processesStarted,
      tasksAssigned,
      tasksApproved: approved,
      tasksRejected: rejected,
      tasksInProgress: inProgress,
      tasksPending: pending,
    };
  });
  return rows.sort((a, b) => (b.processesStarted + b.tasksAssigned) - (a.processesStarted + a.tasksAssigned));
}

/** Report 2: Tasks by Task (template task) */
export type ReportByTaskRow = {
  templateTaskId: string;
  taskName: string;
  processTemplateName: string;
  totalAssignments: number;
  pending: number;
  inProgress: number;
  approved: number;
  rejected: number;
  skipped: number;
};

export async function getReportByTaskData(): Promise<ReportByTaskRow[]> {
  const tasks = await prisma.processTaskAssignment.findMany({
    include: {
      templateTask: { select: { id: true, name: true, processTemplate: { select: { name: true } } } },
    },
  });
  const byTemplateTask = new Map<
    string,
    { name: string; templateName: string; pending: number; inProgress: number; approved: number; rejected: number; skipped: number }
  >();
  for (const t of tasks) {
    const key = t.templateTaskId;
    if (!byTemplateTask.has(key)) {
      byTemplateTask.set(key, {
        name: t.templateTask.name,
        templateName: t.templateTask.processTemplate.name,
        pending: 0,
        inProgress: 0,
        approved: 0,
        rejected: 0,
        skipped: 0,
      });
    }
    const row = byTemplateTask.get(key)!;
    if (t.status === "PENDING") row.pending++;
    else if (t.status === "IN_PROGRESS") row.inProgress++;
    else if (t.status === "APPROVED") row.approved++;
    else if (t.status === "REJECTED") row.rejected++;
    else if (t.status === "SKIPPED") row.skipped++;
  }
  const rows: ReportByTaskRow[] = Array.from(byTemplateTask.entries()).map(([id, v]) => ({
    templateTaskId: id,
    taskName: v.name,
    processTemplateName: v.templateName,
    totalAssignments: v.pending + v.inProgress + v.approved + v.rejected + v.skipped,
    pending: v.pending,
    inProgress: v.inProgress,
    approved: v.approved,
    rejected: v.rejected,
    skipped: v.skipped,
  }));
  return rows.sort((a, b) => b.totalAssignments - a.totalAssignments);
}

/** Report 3: Process instances summary */
export type ReportSummaryRow = {
  instanceId: string;
  instanceName: string;
  processTemplateName: string;
  status: string;
  startedByName: string;
  startDate: string;
  endDate: string | null;
  taskCount: number;
  completedTaskCount: number;
};

export async function getReportSummaryData(): Promise<ReportSummaryRow[]> {
  const instances = await prisma.processInstance.findMany({
    include: {
      processTemplate: { select: { name: true } },
      startedBy: { select: { firstName: true, lastName: true, email: true } },
      tasks: { select: { id: true, status: true } },
    },
    orderBy: { startDateTime: "desc" },
  });
  return instances.map((i) => ({
    instanceId: i.id,
    instanceName: i.name,
    processTemplateName: i.processTemplate.name,
    status: i.status,
    startedByName: `${i.startedBy.firstName} ${i.startedBy.lastName}`.trim() || i.startedBy.email,
    startDate: i.startDateTime.toISOString().slice(0, 19).replace("T", " "),
    endDate: i.endDateTime ? i.endDateTime.toISOString().slice(0, 19).replace("T", " ") : null,
    taskCount: i.tasks.length,
    completedTaskCount: i.tasks.filter((t) => t.status === "APPROVED" || t.status === "REJECTED" || t.status === "SKIPPED").length,
  }));
}

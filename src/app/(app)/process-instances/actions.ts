"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, hasPermission } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { uploadToBunny, isBunnyConfigured } from "@/lib/bunnycdn";

export async function startProcessInstance(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "processInstances.create")) throw new Error("Forbidden");

  const processTemplateId = formData.get("processTemplateId") as string;
  const name = formData.get("name") as string;
  const startDateTime = formData.get("startDateTime") as string;

  const template = await prisma.processTemplate.findUnique({
    where: { id: processTemplateId },
    include: {
      allowedDepartments: { select: { departmentId: true } },
      tasks: { include: { approverRoles: { select: { jobPositionId: true } } }, orderBy: { order: "asc" } },
    },
  });
  if (!template) throw new Error("Template not found");

  const allowedDeptIds = template.allowedDepartments.map((d) => d.departmentId);
  const userPositionIds = (
    await prisma.userPosition.findMany({
      where: { userId: session.user.id },
      select: { positionId: true },
    })
  ).map((p) => p.positionId);
  const userDeptIds = (
    await prisma.jobPosition.findMany({
      where: { id: { in: userPositionIds } },
      select: { departmentId: true },
    })
  ).map((d) => d.departmentId);

  const canStart =
    session.user.role === Role.SUPER_ADMIN ||
    session.user.role === Role.ADMIN ||
    userDeptIds.some((d) => allowedDeptIds.includes(d));
  if (!canStart) throw new Error("You are not allowed to start this process");

  const startDate = startDateTime ? new Date(startDateTime) : new Date();

  const instance = await prisma.processInstance.create({
    data: {
      name,
      processTemplateId,
      startedById: session.user.id,
      startDateTime: startDate,
      status: "RUNNING",
    },
  });

  for (const taskTemplate of template.tasks) {
    const positionIds = taskTemplate.approverRoles.map((r) => r.jobPositionId);
    const userIds = (
      await prisma.userPosition.findMany({
        where: { positionId: { in: positionIds } },
        select: { userId: true },
        distinct: ["userId"],
      })
    ).map((u) => u.userId);

    const assignment = await prisma.processTaskAssignment.create({
      data: {
        processInstanceId: instance.id,
        templateTaskId: taskTemplate.id,
        status: "PENDING",
      },
    });

    if (userIds.length > 0) {
      await prisma.taskAssignmentAssignee.createMany({
        data: userIds.map((userId) => ({ taskId: assignment.id, userId })),
      });
    }
  }

  revalidatePath("/process-instances");
  revalidatePath("/my-processes");
  revalidatePath("/dashboard");
  return instance.id;
}

export async function startTask(taskId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const task = await prisma.processTaskAssignment.findUnique({
    where: { id: taskId },
    include: { possibleAssignees: { select: { id: true } } },
  });
  if (!task) throw new Error("Task not found");

  const canAct =
    session.user.role === Role.SUPER_ADMIN ||
    session.user.role === Role.ADMIN ||
    task.possibleAssignees.some((u) => u.id === session.user!.id);
  if (!canAct) throw new Error("Forbidden");

  await prisma.$transaction([
    prisma.processTaskAssignment.update({
      where: { id: taskId },
      data: { status: "IN_PROGRESS", startedAt: new Date(), currentAssigneeId: session.user.id },
    }),
    prisma.taskAction.create({
      data: { taskId, userId: session.user.id, action: "START" },
    }),
  ]);
  revalidatePath("/process-instances");
  revalidatePath("/my-tasks");
  revalidatePath("/dashboard");
}

export async function approveTask(taskId: string, comment?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const task = await prisma.processTaskAssignment.findUnique({
    where: { id: taskId },
    include: { possibleAssignees: { select: { id: true } }, processInstance: true, templateTask: true },
  });
  if (!task) throw new Error("Task not found");

  const canAct =
    session.user.role === Role.SUPER_ADMIN ||
    session.user.role === Role.ADMIN ||
    task.possibleAssignees.some((u) => u.id === session.user!.id);
  if (!canAct) throw new Error("Forbidden");

  await prisma.$transaction([
    prisma.processTaskAssignment.update({
      where: { id: taskId },
      data: { status: "APPROVED", completedAt: new Date(), currentAssigneeId: session.user.id, comment: comment ?? undefined },
    }),
    prisma.taskAction.create({
      data: { taskId, userId: session.user.id, action: "APPROVE", message: comment ?? undefined },
    }),
  ]);

  const allTasks = await prisma.processTaskAssignment.findMany({
    where: { processInstanceId: task.processInstanceId },
    include: { templateTask: true },
  });
  const mandatoryTasks = allTasks.filter((t) => t.templateTask.mandatory);
  const allMandatoryApproved = mandatoryTasks.every((t) => t.id === taskId || t.status === "APPROVED");
  if (allMandatoryApproved) {
    await prisma.processTaskAssignment.updateMany({
      where: { processInstanceId: task.processInstanceId, status: "PENDING" },
      data: { status: "SKIPPED" },
    });
    await prisma.processInstance.update({
      where: { id: task.processInstanceId },
      data: { status: "COMPLETED", endDateTime: new Date() },
    });
  }

  revalidatePath("/process-instances");
  revalidatePath(`/process-instances/${task.processInstanceId}`);
  revalidatePath("/my-tasks");
  revalidatePath("/dashboard");
}

export async function rejectTask(taskId: string, comment: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const task = await prisma.processTaskAssignment.findUnique({
    where: { id: taskId },
    include: { possibleAssignees: { select: { id: true } } },
  });
  if (!task) throw new Error("Task not found");

  const canAct =
    session.user.role === Role.SUPER_ADMIN ||
    session.user.role === Role.ADMIN ||
    task.possibleAssignees.some((u) => u.id === session.user!.id);
  if (!canAct) throw new Error("Forbidden");

  if (!comment?.trim()) throw new Error("Comment required for rejection");

  await prisma.$transaction([
    prisma.processTaskAssignment.update({
      where: { id: taskId },
      data: { status: "REJECTED", completedAt: new Date(), currentAssigneeId: session.user.id, comment },
    }),
    prisma.taskAction.create({
      data: { taskId, userId: session.user.id, action: "REJECT", message: comment },
    }),
  ]);
  revalidatePath("/process-instances");
  revalidatePath(`/process-instances/${task.processInstanceId}`);
  revalidatePath("/my-tasks");
  revalidatePath("/dashboard");
}

export async function uploadTaskFile(
  taskId: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Unauthorized" };

  const task = await prisma.processTaskAssignment.findUnique({
    where: { id: taskId },
    include: {
      possibleAssignees: { select: { id: true } },
      templateTask: { select: { needFile: true } },
    },
  });
  if (!task) return { ok: false, error: "Task not found" };
  if (!task.templateTask.needFile) return { ok: false, error: "This task does not require a file" };

  const canAct =
    session.user.role === Role.SUPER_ADMIN ||
    session.user.role === Role.ADMIN ||
    task.possibleAssignees.some((u) => u.id === session.user!.id);
  if (!canAct) return { ok: false, error: "Forbidden" };

  if (!isBunnyConfigured()) {
    return {
      ok: false,
      error: "File upload is not configured. Set BUNNY_STORAGE_ZONE, BUNNY_ACCESS_KEY, and BUNNY_CDN_HOST in environment.",
    };
  }

  const file = formData.get("file") as File | null;
  if (!file?.size) return { ok: false, error: "No file provided" };

  const rawName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200) || "file";
  const ext = rawName.includes(".") ? rawName.slice(rawName.lastIndexOf(".")) : "";
  const base = rawName.includes(".") ? rawName.slice(0, rawName.lastIndexOf(".")) : rawName;
  const filename = `${base}${ext}`;
  const path = `bpm/tasks/${taskId}/${filename}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    const fileUrl = await uploadToBunny(buffer, path, contentType);

    await prisma.$transaction([
      prisma.processTaskAssignment.update({
        where: { id: taskId },
        data: { fileUrl },
      }),
      prisma.taskAction.create({
        data: { taskId, userId: session.user.id, action: "UPLOAD_FILE", message: filename },
      }),
    ]);

    revalidatePath("/process-instances");
    revalidatePath(`/process-instances/${task.processInstanceId}`);
    revalidatePath("/my-tasks");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}

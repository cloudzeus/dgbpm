"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, hasPermission } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { uploadToBunny, isBunnyConfigured } from "@/lib/bunnycdn";
import { coerceFieldValue } from "@/lib/process-fields/coerce";
import {
  isEmailConfigured,
  sendEmail,
  buildTaskAssignedEmail,
  buildTaskStartedEmail,
  buildTaskApprovedEmail,
  buildTaskRejectedEmail,
  buildProcessCompletedEmail,
} from "@/lib/email";

export async function startProcessInstance(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  if (!hasPermission(session.user.role, "processInstances.create")) throw new Error("Δεν επιτρέπεται");

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
  if (!template) throw new Error("Το πρότυπο δεν βρέθηκε");

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
  if (!canStart) throw new Error("Δεν επιτρέπεται να ξεκινήσετε αυτή τη διαδικασία");

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
      if (isEmailConfigured()) {
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, firstName: true, lastName: true },
        });
        for (const u of users) {
          const { subject, html } = buildTaskAssignedEmail({
            assigneeEmail: u.email,
            assigneeName: `${u.firstName} ${u.lastName}`.trim() || u.email,
            processName: name,
            taskName: taskTemplate.name,
            instanceId: instance.id,
          });
          sendEmail({ to: u.email, subject, html }).catch((err) =>
            console.error("[BPM] Task assigned email failed:", err)
          );
        }
      }
    }
  }

  revalidatePath("/process-instances");
  revalidatePath("/my-processes");
  revalidatePath("/dashboard");
  return instance.id;
}

export async function startTask(taskId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");

  const task = await prisma.processTaskAssignment.findUnique({
    where: { id: taskId },
    include: { possibleAssignees: { select: { id: true } } },
  });
  if (!task) throw new Error("Η εργασία δεν βρέθηκε");

  const canAct =
    session.user.role === Role.SUPER_ADMIN ||
    session.user.role === Role.ADMIN ||
    task.possibleAssignees.some((u) => u.id === session.user!.id);
  if (!canAct) throw new Error("Δεν επιτρέπεται");

  await prisma.$transaction([
    prisma.processTaskAssignment.update({
      where: { id: taskId },
      data: { status: "IN_PROGRESS", startedAt: new Date(), currentAssigneeId: session.user.id },
    }),
    prisma.taskAction.create({
      data: { taskId, userId: session.user.id, action: "START" },
    }),
  ]);

  if (isEmailConfigured()) {
    const taskWithDetails = await prisma.processTaskAssignment.findUnique({
      where: { id: taskId },
      include: {
        processInstance: { select: { name: true, id: true } },
        templateTask: { select: { name: true } },
        possibleAssignees: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
      },
    });
    if (taskWithDetails) {
      const startedByName = session.user.name ?? session.user.email ?? "Ένας χρήστης";
      const processName = taskWithDetails.processInstance.name;
      const taskName = taskWithDetails.templateTask.name;
      const instanceId = taskWithDetails.processInstance.id;
      for (const pa of taskWithDetails.possibleAssignees) {
        if (pa.user.id === session.user.id) continue;
        const { subject, html } = buildTaskStartedEmail({
          assigneeEmail: pa.user.email,
          assigneeName: `${pa.user.firstName} ${pa.user.lastName}`.trim() || pa.user.email,
          processName,
          taskName,
          startedByName,
          instanceId,
        });
        sendEmail({ to: pa.user.email, subject, html }).catch((err) =>
          console.error("[BPM] Task started email failed:", err)
        );
      }
    }
  }

  revalidatePath("/process-instances");
  revalidatePath("/my-tasks");
  revalidatePath("/dashboard");
}

/** Fields whose captureTaskOrder matches this task's template order. */
async function fieldsForTask(taskId: string) {
  const task = await prisma.processTaskAssignment.findUnique({
    where: { id: taskId },
    include: { templateTask: true, processInstance: true },
  });
  if (!task) throw new Error("Δεν βρέθηκε η εργασία.");
  const fields = await prisma.processFieldDefinition.findMany({
    where: {
      processTemplateId: task.processInstance.processTemplateId,
      deletedAt: null,
      captureTaskOrder: task.templateTask.order,
    },
    orderBy: { order: "asc" },
  });
  return { task, fields };
}

export async function saveTaskFieldValues(taskId: string, values: Record<string, string>) {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  const { task, fields } = await fieldsForTask(taskId);
  const instanceId = task.processInstanceId;
  await prisma.$transaction(async (tx) => {
    for (const f of fields) {
      const res = coerceFieldValue(f.type, values[f.id], false); // required checked separately on complete
      if (!res.ok) throw new Error(`${f.name}: ${res.error}`);
      const existing = await tx.processFieldValue.findUnique({
        where: { processInstanceId_fieldDefinitionId: { processInstanceId: instanceId, fieldDefinitionId: f.id } },
      });
      if (existing) await tx.processFieldValue.update({ where: { id: existing.id }, data: res.columns });
      else await tx.processFieldValue.create({ data: { processInstanceId: instanceId, fieldDefinitionId: f.id, ...res.columns } });
    }
  });
  revalidatePath(`/process-instances/${instanceId}`);
}

/** Throws if any required field for this task is still empty. Call at the start of approveTask. */
export async function assertRequiredFieldsFilled(taskId: string) {
  const { task, fields } = await fieldsForTask(taskId);
  const required = fields.filter((f) => f.required);
  if (required.length === 0) return;
  const values = await prisma.processFieldValue.findMany({
    where: { processInstanceId: task.processInstanceId, fieldDefinitionId: { in: required.map((f) => f.id) } },
  });
  const byField = new Map(values.map((v) => [v.fieldDefinitionId, v]));
  for (const f of required) {
    const v = byField.get(f.id);
    const empty = !v || (v.valueString == null && v.valueNumber == null && v.valueDate == null && v.valueBool == null && v.valueListItemId == null);
    if (empty) throw new Error(`Συμπληρώστε το υποχρεωτικό πεδίο «${f.name}» πριν ολοκληρώσετε το βήμα.`);
  }
}

export async function approveTask(taskId: string, comment?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");

  await assertRequiredFieldsFilled(taskId);

  const task = await prisma.processTaskAssignment.findUnique({
    where: { id: taskId },
    include: { possibleAssignees: { select: { id: true } }, processInstance: true, templateTask: true },
  });
  if (!task) throw new Error("Η εργασία δεν βρέθηκε");

  const canAct =
    session.user.role === Role.SUPER_ADMIN ||
    session.user.role === Role.ADMIN ||
    task.possibleAssignees.some((u) => u.id === session.user!.id);
  if (!canAct) throw new Error("Δεν επιτρέπεται");

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

  if (isEmailConfigured()) {
    const instanceWithStarter = await prisma.processInstance.findUnique({
      where: { id: task.processInstanceId },
      include: { startedBy: { select: { email: true, firstName: true, lastName: true } } },
    });
    if (instanceWithStarter?.startedBy) {
      const toName = `${instanceWithStarter.startedBy.firstName} ${instanceWithStarter.startedBy.lastName}`.trim() || instanceWithStarter.startedBy.email;
      const { subject, html } = buildTaskApprovedEmail({
        toEmail: instanceWithStarter.startedBy.email,
        toName,
        processName: instanceWithStarter.name,
        taskName: task.templateTask.name,
        approvedByName: session.user.name ?? session.user.email ?? "Ένας χρήστης",
        instanceId: task.processInstanceId,
      });
      sendEmail({ to: instanceWithStarter.startedBy.email, subject, html }).catch((err) =>
        console.error("[BPM] Task approved email failed:", err)
      );
      if (allMandatoryApproved) {
        const completed = buildProcessCompletedEmail({
          toEmail: instanceWithStarter.startedBy.email,
          toName,
          processName: instanceWithStarter.name,
          instanceId: task.processInstanceId,
        });
        sendEmail({ to: instanceWithStarter.startedBy.email, subject: completed.subject, html: completed.html }).catch((err) =>
          console.error("[BPM] Process completed email failed:", err)
        );
      }
    }
  }

  revalidatePath("/process-instances");
  revalidatePath(`/process-instances/${task.processInstanceId}`);
  revalidatePath("/my-tasks");
  revalidatePath("/dashboard");
}

export async function rejectTask(taskId: string, comment: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");

  const task = await prisma.processTaskAssignment.findUnique({
    where: { id: taskId },
    include: { possibleAssignees: { select: { id: true } } },
  });
  if (!task) throw new Error("Η εργασία δεν βρέθηκε");

  const canAct =
    session.user.role === Role.SUPER_ADMIN ||
    session.user.role === Role.ADMIN ||
    task.possibleAssignees.some((u) => u.id === session.user!.id);
  if (!canAct) throw new Error("Δεν επιτρέπεται");

  if (!comment?.trim()) throw new Error("Απαιτείται σχόλιο για την απόρριψη");

  await prisma.$transaction([
    prisma.processTaskAssignment.update({
      where: { id: taskId },
      data: { status: "REJECTED", completedAt: new Date(), currentAssigneeId: session.user.id, comment },
    }),
    prisma.taskAction.create({
      data: { taskId, userId: session.user.id, action: "REJECT", message: comment },
    }),
  ]);

  if (isEmailConfigured()) {
    const taskWithInstance = await prisma.processTaskAssignment.findUnique({
      where: { id: taskId },
      include: {
        processInstance: {
          include: { startedBy: { select: { email: true, firstName: true, lastName: true } } },
        },
        templateTask: { select: { name: true } },
      },
    });
    if (taskWithInstance?.processInstance?.startedBy) {
      const starter = taskWithInstance.processInstance.startedBy;
      const toName = `${starter.firstName} ${starter.lastName}`.trim() || starter.email;
      const { subject, html } = buildTaskRejectedEmail({
        toEmail: starter.email,
        toName,
        processName: taskWithInstance.processInstance.name,
        taskName: taskWithInstance.templateTask.name,
        rejectedByName: session.user.name ?? session.user.email ?? "Ένας χρήστης",
        comment,
        instanceId: taskWithInstance.processInstanceId,
      });
      sendEmail({ to: starter.email, subject, html }).catch((err) =>
        console.error("[BPM] Task rejected email failed:", err)
      );
    }
  }

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
  if (!session?.user) return { ok: false, error: "Μη εξουσιοδοτημένη πρόσβαση" };

  const task = await prisma.processTaskAssignment.findUnique({
    where: { id: taskId },
    include: {
      possibleAssignees: { select: { id: true } },
      templateTask: { select: { needFile: true } },
    },
  });
  if (!task) return { ok: false, error: "Η εργασία δεν βρέθηκε" };
  if (!task.templateTask.needFile) return { ok: false, error: "Αυτή η εργασία δεν απαιτεί αρχείο" };

  const canAct =
    session.user.role === Role.SUPER_ADMIN ||
    session.user.role === Role.ADMIN ||
    task.possibleAssignees.some((u) => u.id === session.user!.id);
  if (!canAct) return { ok: false, error: "Δεν επιτρέπεται" };

  if (!isBunnyConfigured()) {
    return {
      ok: false,
      error: "Η μεταφόρτωση αρχείων δεν έχει ρυθμιστεί. Ορίστε τα BUNNY_STORAGE_ZONE, BUNNY_ACCESS_KEY και BUNNY_CDN_HOST στο περιβάλλον.",
    };
  }

  const file = formData.get("file") as File | null;
  if (!file?.size) return { ok: false, error: "Δεν δόθηκε αρχείο" };

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
      error: err instanceof Error ? err.message : "Η μεταφόρτωση απέτυχε",
    };
  }
}

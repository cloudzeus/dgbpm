"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createProcessTemplate(data: {
  name: string;
  description?: string;
  icon: string;
  allowedDepartmentIds: string[];
  tasks: {
    name: string;
    order: number;
    description?: string;
    needFile: boolean;
    mandatory: boolean;
    approverPositionIds: string[];
    notifyOnStartPositionIds?: string[];
    notifyOnCompletePositionIds?: string[];
    approverSameDepartment?: boolean;
    approverDepartmentManager?: boolean;
    notifyOnStartSameDepartment?: boolean;
    notifyOnStartDepartmentManager?: boolean;
    notifyOnCompleteSameDepartment?: boolean;
    notifyOnCompleteDepartmentManager?: boolean;
  }[];
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);

  await prisma.processTemplate.create({
    data: {
      name: data.name,
      description: data.description ?? undefined,
      icon: data.icon,
      createdById: session.user.id,
      allowedDepartments: {
        create: data.allowedDepartmentIds.map((departmentId) => ({ departmentId })),
      },
      tasks: {
        create: data.tasks.map((t) => ({
          name: t.name,
          order: t.order,
          description: t.description ?? undefined,
          needFile: t.needFile,
          mandatory: t.mandatory,
          approverRoles: {
            create: (t.approverPositionIds ?? []).map((jobPositionId) => ({ jobPositionId })),
          },
          notifyOnStartPositions: {
            create: (t.notifyOnStartPositionIds ?? []).map((jobPositionId) => ({ jobPositionId })),
          },
          notifyOnCompletePositions: {
            create: (t.notifyOnCompletePositionIds ?? []).map((jobPositionId) => ({ jobPositionId })),
          },
          approverSameDepartment: t.approverSameDepartment ?? false,
          approverDepartmentManager: t.approverDepartmentManager ?? false,
          notifyOnStartSameDepartment: t.notifyOnStartSameDepartment ?? false,
          notifyOnStartDepartmentManager: t.notifyOnStartDepartmentManager ?? false,
          notifyOnCompleteSameDepartment: t.notifyOnCompleteSameDepartment ?? false,
          notifyOnCompleteDepartmentManager: t.notifyOnCompleteDepartmentManager ?? false,
        })),
      },
    },
  });
  revalidatePath("/process-templates");
  revalidatePath("/dashboard");
}

export async function updateProcessTemplate(
  id: string,
  data: {
    name: string;
    description?: string;
    icon: string;
    allowedDepartmentIds: string[];
  tasks: {
    id?: string;
    name: string;
    order: number;
    description?: string;
    needFile: boolean;
    mandatory: boolean;
    approverPositionIds: string[];
    notifyOnStartPositionIds?: string[];
    notifyOnCompletePositionIds?: string[];
    approverSameDepartment?: boolean;
    approverDepartmentManager?: boolean;
    notifyOnStartSameDepartment?: boolean;
    notifyOnStartDepartmentManager?: boolean;
    notifyOnCompleteSameDepartment?: boolean;
    notifyOnCompleteDepartmentManager?: boolean;
  }[];
}
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);

  await prisma.$transaction(async (tx) => {
    await tx.processTemplateDepartment.deleteMany({ where: { processTemplateId: id } });
    await tx.processTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? undefined,
        icon: data.icon,
        allowedDepartments: {
          create: data.allowedDepartmentIds.map((departmentId) => ({ departmentId })),
        },
      },
    });

    const existingTasks = await tx.processTaskTemplate.findMany({
      where: { processTemplateId: id },
      include: { approverRoles: true },
    });
    for (const task of existingTasks) {
      await tx.taskApproverRole.deleteMany({ where: { taskTemplateId: task.id } });
    }
    await tx.processTaskTemplate.deleteMany({ where: { processTemplateId: id } });

    for (const t of data.tasks.sort((a, b) => a.order - b.order)) {
      await tx.processTaskTemplate.create({
        data: {
          processTemplateId: id,
          name: t.name,
          order: t.order,
          description: t.description ?? undefined,
          needFile: t.needFile,
          mandatory: t.mandatory,
          approverRoles: {
            create: (t.approverPositionIds ?? []).map((jobPositionId) => ({ jobPositionId })),
          },
          notifyOnStartPositions: {
            create: (t.notifyOnStartPositionIds ?? []).map((jobPositionId) => ({ jobPositionId })),
          },
          notifyOnCompletePositions: {
            create: (t.notifyOnCompletePositionIds ?? []).map((jobPositionId) => ({ jobPositionId })),
          },
          approverSameDepartment: t.approverSameDepartment ?? false,
          approverDepartmentManager: t.approverDepartmentManager ?? false,
          notifyOnStartSameDepartment: t.notifyOnStartSameDepartment ?? false,
          notifyOnStartDepartmentManager: t.notifyOnStartDepartmentManager ?? false,
          notifyOnCompleteSameDepartment: t.notifyOnCompleteSameDepartment ?? false,
          notifyOnCompleteDepartmentManager: t.notifyOnCompleteDepartmentManager ?? false,
        },
      });
    }
  });

  revalidatePath("/process-templates");
  revalidatePath("/dashboard");
}

export async function deleteProcessTemplate(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);

  await prisma.processTemplate.delete({ where: { id } });
  revalidatePath("/process-templates");
  revalidatePath("/dashboard");
}

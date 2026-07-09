"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { isDescendant } from "@/lib/org-tree";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

async function guard() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);
}

function revalidate() {
  revalidatePath("/organization");
  revalidatePath("/departments");
  revalidatePath("/positions");
  revalidatePath("/dashboard");
}

export async function createDepartmentNode(parentId: string | null) {
  await guard();
  await prisma.department.create({
    data: { name: "Νέο τμήμα", color: "#6366f1", parentId: parentId ?? undefined },
  });
  revalidate();
}

export async function renameDepartment(id: string, name: string) {
  await guard();
  await prisma.department.update({ where: { id }, data: { name } });
  revalidate();
}

export async function updateDepartmentMeta(
  id: string,
  data: { name?: string; email?: string | null; phoneNumber?: string | null; color?: string }
) {
  await guard();
  await prisma.department.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email ?? undefined,
      phoneNumber: data.phoneNumber ?? undefined,
      color: data.color,
    },
  });
  revalidate();
}

/** Reparent with cycle protection. newParentId=null → root. */
export async function reparentDepartment(id: string, newParentId: string | null) {
  await guard();
  if (id === newParentId) throw new Error("Ένα τμήμα δεν μπορεί να είναι γονέας του εαυτού του.");
  const all = await prisma.department.findMany({ select: { id: true, parentId: true } });
  if (newParentId && isDescendant(all, id, newParentId)) {
    throw new Error("Δεν επιτρέπεται: ο νέος γονέας ανήκει στο υποδέντρο του τμήματος.");
  }
  await prisma.department.update({ where: { id }, data: { parentId: newParentId } });
  revalidate();
}

/** Delete a department; its children are reparented to the deleted node's parent. */
export async function deleteDepartmentNode(id: string) {
  await guard();
  const dept = await prisma.department.findUnique({ where: { id }, select: { parentId: true } });
  if (!dept) return;
  await prisma.$transaction([
    prisma.department.updateMany({ where: { parentId: id }, data: { parentId: dept.parentId } }),
    prisma.department.delete({ where: { id } }),
  ]);
  revalidate();
}

export async function createPosition(departmentId: string) {
  await guard();
  await prisma.jobPosition.create({ data: { name: "Νέα θέση", departmentId } });
  revalidate();
}

export async function renamePosition(id: string, name: string) {
  await guard();
  await prisma.jobPosition.update({ where: { id }, data: { name } });
  revalidate();
}

export async function deletePosition(id: string) {
  await guard();
  await prisma.jobPosition.delete({ where: { id } });
  revalidate();
}

/** Persist a new order for a department's positions (orderedIds = full list top→bottom). */
export async function reorderPositions(orderedIds: string[]) {
  await guard();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.jobPosition.update({ where: { id }, data: { sortOrder: index } })
    )
  );
  revalidate();
}

export async function setPositionManager(positionId: string, userId: string | null) {
  await guard();
  await prisma.jobPosition.update({ where: { id: positionId }, data: { managerId: userId } });
  revalidate();
}

export async function assignUserToPosition(positionId: string, userId: string) {
  await guard();
  await prisma.userPosition.upsert({
    where: { userId_positionId: { userId, positionId } },
    create: { userId, positionId },
    update: {},
  });
  revalidate();
}

export async function removeUserFromPosition(positionId: string, userId: string) {
  await guard();
  await prisma.userPosition.deleteMany({ where: { positionId, userId } });
  revalidate();
}

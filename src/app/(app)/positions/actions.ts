"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createJobPosition(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  const name = formData.get("name") as string;
  const departmentId = formData.get("departmentId") as string;
  const managerId = (formData.get("managerId") as string) || null;

  await prisma.jobPosition.create({
    data: {
      name,
      departmentId,
      managerId: managerId || undefined,
    },
  });
  revalidatePath("/positions");
  revalidatePath("/dashboard");
}

export async function updateJobPosition(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  const name = formData.get("name") as string;
  const departmentId = formData.get("departmentId") as string;
  const managerId = (formData.get("managerId") as string) || null;

  await prisma.jobPosition.update({
    where: { id },
    data: {
      name,
      departmentId,
      managerId: managerId || undefined,
    },
  });
  revalidatePath("/positions");
  revalidatePath("/dashboard");
}

export async function deleteJobPosition(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  await prisma.jobPosition.delete({ where: { id } });
  revalidatePath("/positions");
  revalidatePath("/dashboard");
}

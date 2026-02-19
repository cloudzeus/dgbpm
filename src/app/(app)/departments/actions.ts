"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createDepartment(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  const name = formData.get("name") as string;
  const email = (formData.get("email") as string) || undefined;
  const phoneNumber = (formData.get("phoneNumber") as string) || undefined;
  const parentId = (formData.get("parentId") as string) || null;
  const color = (formData.get("color") as string) || "#6366f1";

  await prisma.department.create({
    data: { name, email, phoneNumber, parentId: parentId || undefined, color },
  });
  revalidatePath("/departments");
  revalidatePath("/dashboard");
}

export async function updateDepartment(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  const name = formData.get("name") as string;
  const email = (formData.get("email") as string) || undefined;
  const phoneNumber = (formData.get("phoneNumber") as string) || undefined;
  const parentId = (formData.get("parentId") as string) || null;
  const color = (formData.get("color") as string) || "#6366f1";

  await prisma.department.update({
    where: { id },
    data: { name, email, phoneNumber, parentId: parentId || undefined, color },
  });
  revalidatePath("/departments");
  revalidatePath("/dashboard");
}

export async function deleteDepartment(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  await prisma.department.delete({ where: { id } });
  revalidatePath("/departments");
  revalidatePath("/dashboard");
}

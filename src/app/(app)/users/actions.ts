"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";

export async function createUser(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const phone = (formData.get("phone") as string) || undefined;
  const mobile = (formData.get("mobile") as string) || undefined;
  const address = (formData.get("address") as string) || undefined;
  const role = (formData.get("role") as Role) || Role.EMPLOYEE;
  const positionIds = formData.getAll("positionIds") as string[];

  if (session.user.role !== Role.SUPER_ADMIN && role === Role.SUPER_ADMIN) {
    throw new Error("Forbidden: cannot grant Super Admin");
  }

  const hashedPassword = password ? await hash(password, 12) : undefined;
  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      phone,
      mobile,
      address,
      role,
      hashedPassword: hashedPassword ?? undefined,
    },
  });

  if (positionIds.length > 0) {
    await prisma.userPosition.createMany({
      data: positionIds.map((positionId) => ({
        userId: user.id,
        positionId,
      })),
    });
  }

  revalidatePath("/users");
  revalidatePath("/dashboard");
}

export async function updateUser(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const phone = (formData.get("phone") as string) || undefined;
  const mobile = (formData.get("mobile") as string) || undefined;
  const address = (formData.get("address") as string) || undefined;
  const role = (formData.get("role") as Role) || Role.EMPLOYEE;
  const positionIds = formData.getAll("positionIds") as string[];

  if (session.user.role !== Role.SUPER_ADMIN && role === Role.SUPER_ADMIN) {
    throw new Error("Forbidden: cannot grant Super Admin");
  }

  const hashedPassword = password ? await hash(password, 12) : undefined;
  await prisma.user.update({
    where: { id },
    data: {
      email,
      firstName,
      lastName,
      phone,
      mobile,
      address,
      role,
      ...(hashedPassword && { hashedPassword }),
    },
  });

  await prisma.userPosition.deleteMany({ where: { userId: id } });
  if (positionIds.length > 0) {
    await prisma.userPosition.createMany({
      data: positionIds.map((positionId) => ({ userId: id, positionId })),
    });
  }

  revalidatePath("/users");
  revalidatePath("/dashboard");
}

export async function deleteUser(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  await prisma.user.delete({ where: { id } });
  revalidatePath("/users");
  revalidatePath("/dashboard");
}

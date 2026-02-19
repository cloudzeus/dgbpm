"use server";

import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export async function register(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;

  if (!email || !password || !firstName || !lastName) {
    return { error: "All fields are required." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists." };

  const hashedPassword = await hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      hashedPassword,
      firstName,
      lastName,
      role: "EMPLOYEE",
    },
  });

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  redirect("/dashboard");
}

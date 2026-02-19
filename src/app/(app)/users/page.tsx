import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  const users = await prisma.user.findMany({
    include: {
      positions: {
        include: {
          position: { select: { id: true, name: true, department: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const positions = await prisma.jobPosition.findMany({
    include: { department: { select: { name: true } } },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage users, roles, and position assignments.</p>
      </div>
      <UsersClient users={users} positions={positions} currentRole={session.user.role} />
    </div>
  );
}

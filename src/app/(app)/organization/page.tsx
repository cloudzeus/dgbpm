import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { OrganizationClient } from "./organization-client";

export default async function OrganizationPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  const [departments, users] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, color: true, parentId: true, email: true, phoneNumber: true,
        positions: {
          orderBy: { name: "asc" },
          select: {
            id: true, name: true, managerId: true,
            users: { select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
          },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Οργανόγραμμα</h1>
        <p className="text-muted-foreground">
          Στήσε την ιεραρχία τμημάτων, τις θέσεις εργασίας και τις αναθέσεις χρηστών.
        </p>
      </div>
      <OrganizationClient departments={departments} users={users} />
    </div>
  );
}

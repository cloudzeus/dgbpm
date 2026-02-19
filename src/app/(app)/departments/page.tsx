import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { DepartmentsClient } from "./departments-client";

export default async function DepartmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  const departments = await prisma.department.findMany({
    include: { parent: { select: { name: true } }, _count: { select: { positions: true } } },
    orderBy: { name: "asc" },
  });

  const parentOptions = departments.map((d) => ({ id: d.id, name: d.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Departments</h1>
        <p className="text-muted-foreground">Manage departments and hierarchy.</p>
      </div>
      <DepartmentsClient
        departments={departments}
        parentOptions={parentOptions}
      />
    </div>
  );
}

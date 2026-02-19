import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { PositionsClient } from "./positions-client";

export default async function PositionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);

  const positions = await prisma.jobPosition.findMany({
    include: {
      department: { select: { name: true, id: true } },
      manager: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
  });

  const departments = await prisma.department.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const users = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { firstName: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Job Positions</h1>
        <p className="text-muted-foreground">Manage job positions and managers.</p>
      </div>
      <PositionsClient
        positions={positions}
        departments={departments}
        users={users}
      />
    </div>
  );
}

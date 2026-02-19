import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { ProcessTemplatesClient } from "./process-templates-client";

export default async function ProcessTemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);

  const templates = await prisma.processTemplate.findMany({
    include: {
      allowedDepartments: { include: { department: { select: { name: true } } } },
      _count: { select: { tasks: true } },
      tasks: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          order: true,
          description: true,
          needFile: true,
          mandatory: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const departments = await prisma.department.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const positions = await prisma.jobPosition.findMany({
    include: { department: { select: { name: true } } },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Process Templates</h1>
        <p className="text-muted-foreground">Define reusable process templates with tasks and approvers.</p>
      </div>
      <ProcessTemplatesClient
        templates={templates}
        departments={departments}
        positions={positions}
      />
    </div>
  );
}

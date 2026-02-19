import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProcessInstancesClient } from "./process-instances-client";

export default async function ProcessInstancesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const instances = await prisma.processInstance.findMany({
    include: {
      processTemplate: { select: { name: true, icon: true } },
      startedBy: { select: { firstName: true, lastName: true, email: true } },
      tasks: {
        include: {
          templateTask: true,
          currentAssignee: { select: { firstName: true, lastName: true } },
          possibleAssignees: { select: { id: true } },
          actions: {
            include: { user: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        orderBy: [{ templateTask: { order: "asc" } }],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const templates = await prisma.processTemplate.findMany({
    include: {
      allowedDepartments: { select: { departmentId: true } },
    },
  });

  const userPositionIds = (
    await prisma.userPosition.findMany({
      where: { userId: session.user.id },
      select: { positionId: true },
    })
  ).map((p) => p.positionId);
  const userDeptIds = (
    await prisma.jobPosition.findMany({
      where: { id: { in: userPositionIds } },
      select: { departmentId: true },
    })
  ).map((d) => d.departmentId);

  const allowedTemplates = templates.filter(
    (t) =>
      session.user!.role === "SUPER_ADMIN" ||
      session.user!.role === "ADMIN" ||
      t.allowedDepartments.some((d) => userDeptIds.includes(d.departmentId))
  );

  const isSuperOrAdmin =
    session.user.role === "SUPER_ADMIN" || session.user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Process Instances</h1>
        <p className="text-muted-foreground">View and manage running and completed processes.</p>
      </div>
      <ProcessInstancesClient
        instances={instances}
        allowedTemplates={allowedTemplates}
        currentUserId={session.user.id}
        isSuperOrAdmin={isSuperOrAdmin}
      />
    </div>
  );
}

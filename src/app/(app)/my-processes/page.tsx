import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MyProcessesClient } from "./my-processes-client";

export default async function MyProcessesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const instances = await prisma.processInstance.findMany({
    where: { startedById: session.user.id },
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

  const isSuperOrAdmin =
    session.user.role === "SUPER_ADMIN" || session.user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Processes</h1>
        <p className="text-muted-foreground">Process instances you started.</p>
      </div>
      <MyProcessesClient
        instances={instances}
        currentUserId={session.user.id}
        isSuperOrAdmin={isSuperOrAdmin}
      />
    </div>
  );
}

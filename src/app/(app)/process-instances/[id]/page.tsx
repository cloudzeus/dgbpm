import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProcessIcon } from "@/lib/process-icons";
import { instanceStatusMeta } from "@/lib/process-status";
import { formatDateTime } from "@/lib/format";
import { ProcessInstanceDetail } from "./process-instance-detail";

export default async function ProcessInstancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const { id } = await params;

  const instance = await prisma.processInstance.findUnique({
    where: { id },
    include: {
      processTemplate: { select: { name: true, icon: true } },
      startedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      tasks: {
        include: {
          templateTask: true,
          currentAssignee: { select: { firstName: true, lastName: true } },
          possibleAssignees: { select: { id: true } },
          actions: { include: { user: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: [{ templateTask: { order: "asc" } }],
      },
    },
  });

  if (!instance) notFound();

  const isSuperOrAdmin =
    session.user!.role === "SUPER_ADMIN" || session.user!.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/process-instances">← Πίσω</Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold mt-2">{instance.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <ProcessIcon icon={instance.processTemplate.icon} className="size-4" />
            {instance.processTemplate.name}
          </p>
        </div>
        <Badge variant={instanceStatusMeta(instance.status).variant}>
          {instanceStatusMeta(instance.status).label}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <div>
          <span className="text-muted-foreground">Εκκίνηση από:</span>{" "}
          {instance.startedBy.firstName} {instance.startedBy.lastName}
        </div>
        <div>
          <span className="text-muted-foreground">Έναρξη:</span>{" "}
          {formatDateTime(instance.startDateTime)}
        </div>
        {instance.endDateTime && (
          <div>
            <span className="text-muted-foreground">Λήξη:</span>{" "}
            {formatDateTime(instance.endDateTime)}
          </div>
        )}
      </div>

      <ProcessInstanceDetail
        instance={instance}
        currentUserId={session.user.id}
        isSuperOrAdmin={isSuperOrAdmin}
      />
    </div>
  );
}

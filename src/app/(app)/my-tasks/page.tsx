import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProcessIcon } from "@/lib/process-icons";

export default async function MyTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const tasks = await prisma.processTaskAssignment.findMany({
    where: {
      possibleAssignees: { some: { id: session.user.id } },
      status: { notIn: ["APPROVED", "REJECTED", "SKIPPED"] },
    },
    include: {
      processInstance: {
        include: {
          processTemplate: { select: { name: true, icon: true } },
          startedBy: { select: { firstName: true, lastName: true } },
        },
      },
      templateTask: { select: { name: true, order: true, needFile: true, mandatory: true } },
    },
    orderBy: [{ processInstance: { startDateTime: "desc" } }, { templateTask: { order: "asc" } }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <p className="text-muted-foreground">Tasks assigned to you (current and overdue).</p>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Process</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started by</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <ProcessIcon icon={t.processInstance.processTemplate.icon} className="size-4 inline mr-1" />
                  {t.processInstance.name}
                </TableCell>
                <TableCell>
                  {t.templateTask.name}
                  {t.templateTask.mandatory && (
                    <Badge variant="success" className="ml-1 text-xs">Mandatory</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      t.status === "APPROVED"
                        ? "success"
                        : t.status === "REJECTED"
                          ? "destructive"
                          : t.status === "IN_PROGRESS"
                            ? "info"
                            : "warning"
                    }
                  >
                    {t.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {t.processInstance.startedBy.firstName} {t.processInstance.startedBy.lastName}
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/process-instances/${t.processInstanceId}`}>Open</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {tasks.length === 0 && (
        <p className="text-muted-foreground text-center py-8">No pending tasks assigned to you.</p>
      )}
    </div>
  );
}

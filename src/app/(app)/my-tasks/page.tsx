import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MyTasksTable, type MyTaskRow } from "./my-tasks-table";

export default async function MyTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const tasks = await prisma.processTaskAssignment.findMany({
    where: {
      possibleAssignees: { some: { id: session.user.id } },
      status: { notIn: ["APPROVED", "REJECTED", "SKIPPED"] },
      // Μόνο εργασίες ενεργών διαδικασιών (όχι ακυρωμένων/ολοκληρωμένων).
      processInstance: { status: "RUNNING" },
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

  const rows: MyTaskRow[] = tasks.map((t) => ({
    id: t.id,
    processInstanceId: t.processInstanceId,
    processInstanceName: t.processInstance.name,
    processIcon: t.processInstance.processTemplate.icon,
    taskName: t.templateTask.name,
    mandatory: t.templateTask.mandatory,
    status: t.status,
    startedByName: `${t.processInstance.startedBy.firstName} ${t.processInstance.startedBy.lastName}`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ui-page-title">Οι Εργασίες μου</h1>
        <p className="ui-page-subtitle">Εργασίες που σας έχουν ανατεθεί (τρέχουσες και εκπρόθεσμες).</p>
      </div>
      <MyTasksTable tasks={rows} />
    </div>
  );
}

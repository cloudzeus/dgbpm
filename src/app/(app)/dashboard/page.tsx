import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { FiUsers, FiFolder, FiBriefcase, FiList, FiCheckSquare } from "react-icons/fi";
import { DashboardProcessSection } from "./dashboard-process-section";
import { DashboardOverview } from "./dashboard-overview";
import { getOverviewData } from "../reports/overview-data";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const role = session.user.role;

  const templates = await prisma.processTemplate.findMany({
    include: { allowedDepartments: { select: { departmentId: true } } },
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

  const tasks = await prisma.processTaskAssignment.findMany({
    where: isSuperOrAdmin
      ? {}
      : { possibleAssignees: { some: { id: session.user.id } } },
    include: {
      processInstance: {
        select: {
          name: true,
          processTemplate: { select: { name: true, icon: true } },
          startedBy: { select: { firstName: true, lastName: true } },
        },
      },
      templateTask: { select: { name: true, needFile: true, mandatory: true } },
      possibleAssignees: { select: { id: true } },
    },
    orderBy: [{ processInstance: { startDateTime: "desc" } }, { templateTask: { order: "asc" } }],
  });

  const dashboardTemplates = allowedTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    icon: t.icon,
  }));
  const dashboardTasks = tasks.map((t) => ({
    id: t.id,
    status: t.status,
    fileUrl: t.fileUrl,
    processInstance: t.processInstance,
    templateTask: t.templateTask,
    possibleAssignees: t.possibleAssignees,
  }));

  if (role === Role.SUPER_ADMIN || role === Role.ADMIN) {
    const [userCount, deptCount, positionCount, templateCount, instanceCount, overview] = await Promise.all([
      prisma.user.count(),
      prisma.department.count(),
      prisma.jobPosition.count(),
      prisma.processTemplate.count(),
      prisma.processInstance.count(),
      getOverviewData(),
    ]);

    const entityStats = [
      { label: "Χρήστες", value: userCount, icon: FiUsers },
      { label: "Τμήματα", value: deptCount, icon: FiFolder },
      { label: "Θέσεις Εργασίας", value: positionCount, icon: FiBriefcase },
      { label: "Πρότυπα", value: templateCount, icon: FiList },
      { label: "Διαδικασίες (σύνολο)", value: instanceCount, icon: FiCheckSquare },
    ];

    return (
      <div className="space-y-6">
        <div>
          <h1 className="ui-page-title">Πίνακας Ελέγχου</h1>
          <p className="ui-page-subtitle">Ζωντανή επισκόπηση ροών εργασίας, εργασιών και απόδοσης διαδικασιών.</p>
        </div>

        <DashboardOverview data={overview} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {entityStats.map((s) => (
            <Card key={s.label} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="ui-eyebrow">{s.label}</CardTitle>
                <s.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="ui-metric">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DashboardProcessSection
          allowedTemplates={dashboardTemplates}
          tasks={dashboardTasks}
          currentUserId={session.user.id}
          isSuperOrAdmin={isSuperOrAdmin}
        />
      </div>
    );
  }

  if (role === Role.MANAGER) {
    const myPositionIds = (
      await prisma.userPosition.findMany({
        where: { userId: session.user.id },
        select: { positionId: true },
      })
    ).map((p) => p.positionId);
    const myDeptIds = (
      await prisma.jobPosition.findMany({
        where: { id: { in: myPositionIds } },
        select: { departmentId: true },
      })
    ).map((d) => d.departmentId);
    const myDeptProcesses = await prisma.processInstance.count({
      where: {
        processTemplate: {
          allowedDepartments: { some: { departmentId: { in: myDeptIds } } },
        },
      },
    });
    const myTeamTasks = await prisma.processTaskAssignment.count({
      where: {
        status: { notIn: ["APPROVED", "REJECTED", "SKIPPED"] },
        possibleAssignees: { some: { id: session.user.id } },
      },
    });

    return (
      <div className="space-y-8">
        <div>
          <h1 className="ui-page-title">Πίνακας Ελέγχου Προϊσταμένου</h1>
          <p className="ui-page-subtitle">Οι διαδικασίες του τμήματός μου και οι εργασίες της ομάδας.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Διαδικασίες του Τμήματός μου</CardTitle>
              <CardDescription>Διαδικασίες σε εξέλιξη, σε καθυστέρηση και ολοκληρωμένες</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="ui-metric">{myDeptProcesses}</div>
              <a href="/process-instances" className="text-sm text-primary underline">
                Προβολή όλων
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Εργασίες της Ομάδας μου</CardTitle>
              <CardDescription>Εργασίες που μπορούν να εγκρίνουν οι θέσεις σας</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="ui-metric">{myTeamTasks}</div>
              <a href="/my-tasks" className="text-sm text-primary underline">
                Προβολή εργασιών
              </a>
            </CardContent>
          </Card>
        </div>

        <DashboardProcessSection
          allowedTemplates={dashboardTemplates}
          tasks={dashboardTasks}
          currentUserId={session.user.id}
          isSuperOrAdmin={isSuperOrAdmin}
        />
      </div>
    );
  }

  const myTasks = await prisma.processTaskAssignment.count({
    where: {
      possibleAssignees: { some: { id: session.user.id } },
      status: { notIn: ["APPROVED", "REJECTED", "SKIPPED"] },
    },
  });
  const myProcesses = await prisma.processInstance.count({
    where: { startedById: session.user.id },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="ui-page-title">Πίνακας Ελέγχου Υπαλλήλου</h1>
        <p className="ui-page-subtitle">Οι εργασίες και οι διαδικασίες μου.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Οι Εργασίες μου</CardTitle>
            <CardDescription>Τρέχουσες και εκπρόθεσμες εργασίες</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="ui-metric">{myTasks}</div>
            <a href="/my-tasks" className="text-sm text-primary underline">
              Προβολή εργασιών
            </a>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Οι Διαδικασίες μου</CardTitle>
            <CardDescription>Διαδικασίες που ξεκίνησα</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="ui-metric">{myProcesses}</div>
            <a href="/my-processes" className="text-sm text-primary underline">
              Προβολή διαδικασιών
            </a>
          </CardContent>
        </Card>
      </div>

      <DashboardProcessSection
        allowedTemplates={dashboardTemplates}
        tasks={dashboardTasks}
        currentUserId={session.user.id}
        isSuperOrAdmin={isSuperOrAdmin}
      />
    </div>
  );
}

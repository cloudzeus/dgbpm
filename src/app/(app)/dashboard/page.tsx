import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { FiUsers, FiFolder, FiBriefcase, FiList, FiCheckSquare } from "react-icons/fi";
import { DashboardProcessSection } from "./dashboard-process-section";

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
    const [userCount, deptCount, positionCount, templateCount, instanceCount] = await Promise.all([
      prisma.user.count(),
      prisma.department.count(),
      prisma.jobPosition.count(),
      prisma.processTemplate.count(),
      prisma.processInstance.count(),
    ]);

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Πίνακας Ελέγχου</h1>
          <p className="text-muted-foreground">Επισκόπηση χρηστών, τμημάτων, θέσεων εργασίας και διαδικασιών.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Χρήστες</CardTitle>
              <FiUsers className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Τμήματα</CardTitle>
              <FiFolder className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deptCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Θέσεις Εργασίας</CardTitle>
              <FiBriefcase className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{positionCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Πρότυπα Διαδικασιών</CardTitle>
              <FiList className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{templateCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Διαδικασίες</CardTitle>
              <FiCheckSquare className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{instanceCount}</div>
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
          <h1 className="text-2xl font-bold">Πίνακας Ελέγχου Προϊσταμένου</h1>
          <p className="text-muted-foreground">Οι διαδικασίες του τμήματός μου και οι εργασίες της ομάδας.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Διαδικασίες του Τμήματός μου</CardTitle>
              <CardDescription>Διαδικασίες σε εξέλιξη, σε καθυστέρηση και ολοκληρωμένες</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myDeptProcesses}</div>
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
              <div className="text-2xl font-bold">{myTeamTasks}</div>
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
        <h1 className="text-2xl font-bold">Πίνακας Ελέγχου Υπαλλήλου</h1>
        <p className="text-muted-foreground">Οι εργασίες και οι διαδικασίες μου.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Οι Εργασίες μου</CardTitle>
            <CardDescription>Τρέχουσες και εκπρόθεσμες εργασίες</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myTasks}</div>
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
            <div className="text-2xl font-bold">{myProcesses}</div>
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

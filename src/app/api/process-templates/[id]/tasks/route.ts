import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tasks = await prisma.processTaskTemplate.findMany({
    where: { processTemplateId: id },
    orderBy: { order: "asc" },
    include: {
      approverRoles: { select: { jobPositionId: true } },
      notifyOnStartPositions: { select: { jobPositionId: true } },
      notifyOnCompletePositions: { select: { jobPositionId: true } },
    },
  });

  return NextResponse.json({
    tasks: tasks.map((t) => ({
      name: t.name,
      order: t.order,
      description: t.description,
      needFile: t.needFile,
      mandatory: t.mandatory,
      approverRoles: t.approverRoles,
      notifyOnStartPositionIds: t.notifyOnStartPositions.map((p) => p.jobPositionId),
      notifyOnCompletePositionIds: t.notifyOnCompletePositions.map((p) => p.jobPositionId),
      approverSameDepartment: t.approverSameDepartment,
      approverDepartmentManager: t.approverDepartmentManager,
      notifyOnStartSameDepartment: t.notifyOnStartSameDepartment,
      notifyOnStartDepartmentManager: t.notifyOnStartDepartmentManager,
      notifyOnCompleteSameDepartment: t.notifyOnCompleteSameDepartment,
      notifyOnCompleteDepartmentManager: t.notifyOnCompleteDepartmentManager,
    })),
  });
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { planInstances, mulberry32, type SeedTemplate, type SeedUser } from "@/lib/demo-seeder";
import { buildSamplePools } from "@/lib/demo-connector-sample";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);
  return session;
}

/** Δεδομένα βήματος 1 — επισκόπηση όσων υπάρχουν ήδη. */
export async function getMigrationOverview() {
  await requireSuperAdmin();
  const [company, departments, positions, users, templates, lookupLists, connectors, demoInstances, demoTemplates] =
    await Promise.all([
      prisma.company.findFirst({ include: { activities: true } }),
      prisma.department.findMany({ orderBy: { name: "asc" } }),
      prisma.jobPosition.findMany({ include: { department: { select: { name: true } } }, orderBy: { name: "asc" } }),
      prisma.user.findMany({
        include: { positions: { include: { position: { select: { name: true, departmentId: true } } } } },
        orderBy: [{ lastName: "asc" }],
      }),
      prisma.processTemplate.findMany({
        include: { _count: { select: { tasks: true, fields: true, instances: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.lookupList.findMany({ include: { _count: { select: { items: true } } } }),
      prisma.connector.findMany({ where: { enabled: true, lastTestOk: true }, select: { type: true } }),
      prisma.processInstance.count({ where: { isDemo: true } }),
      prisma.processTemplate.count({ where: { isDemo: true } }),
    ]);
  return {
    company: company ? { name: company.name, afm: company.afm } : null,
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    positions: positions.map((p) => ({ id: p.id, name: p.name, department: p.department.name })),
    users: users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      positions: u.positions.map((up) => up.position.name),
    })),
    templates: templates.map((t) => ({
      id: t.id, name: t.name, isDemo: t.isDemo,
      taskCount: t._count.tasks, fieldCount: t._count.fields, instanceCount: t._count.instances,
    })),
    lookupLists: lookupLists.map((l) => ({ id: l.id, name: l.name, itemCount: l._count.items })),
    activeConnectors: connectors.map((c) => c.type),
    demoInstanceCount: demoInstances,
    demoTemplateCount: demoTemplates,
  };
}

export type MigrationOverview = Awaited<ReturnType<typeof getMigrationOverview>>;

const CHUNK = 10;

/** Βήμα 4 — δημιουργία demo instances. ΜΟΝΟ εγγραφές ΒΔ, καμία ειδοποίηση. */
export async function generateDemoInstances(input: {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  count: number;
  completedRatio: number; // 0..1
}): Promise<
  | { ok: true; instances: number; tasks: number; actions: number; fieldValues: number; failedChunks: number }
  | { ok: false; error: string }
> {
  await requireSuperAdmin();

  const start = new Date(`${input.startDate}T00:00:00`);
  const end = new Date(`${input.endDate}T23:59:59`);
  const now = new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime()))
    return { ok: false, error: "Μη έγκυρο εύρος ημερομηνιών." };
  // Απόρριψη μόνο αν η ΗΜΕΡΑ λήξης είναι μετά τη σημερινή (endDate = σήμερα επιτρέπεται)
  if (new Date(`${input.endDate}T00:00:00`) > now)
    return { ok: false, error: "Η ημερομηνία λήξης δεν μπορεί να είναι μελλοντική." };
  // Clamp του εύρους σχεδιασμού στο τώρα, ώστε endDate = σήμερα να δουλεύει
  const effectiveEnd = new Date(Math.min(end.getTime(), now.getTime()));
  if (start >= effectiveEnd)
    return { ok: false, error: "Μη έγκυρο εύρος ημερομηνιών." };
  const count = Math.floor(input.count);
  if (!Number.isFinite(count) || count < 1 || count > 1000)
    return { ok: false, error: "Το πλήθος πρέπει να είναι 1 έως 1000." };
  const ratio = Math.min(1, Math.max(0, input.completedRatio));

  const [templatesRaw, usersRaw] = await Promise.all([
    prisma.processTemplate.findMany({
      include: {
        tasks: { include: { approverRoles: true }, orderBy: { order: "asc" } },
        fields: { where: { deletedAt: null }, include: { lookupList: { include: { items: true } } } },
        allowedDepartments: true,
      },
    }),
    prisma.user.findMany({
      include: { positions: { include: { position: { select: { id: true, departmentId: true } } } } },
    }),
  ]);
  if (templatesRaw.length === 0)
    return { ok: false, error: "Δεν υπάρχουν πρότυπα διαδικασιών. Δημιουργήστε πρώτα (βήμα 2)." };
  const users: SeedUser[] = usersRaw
    .filter((u) => u.positions.length > 0)
    .map((u) => ({
      id: u.id,
      departmentIds: [...new Set(u.positions.map((p) => p.position.departmentId))],
      positionIds: u.positions.map((p) => p.position.id),
    }));
  if (users.length === 0)
    return { ok: false, error: "Δεν υπάρχουν χρήστες με θέσεις εργασίας." };

  const templates: SeedTemplate[] = templatesRaw
    .filter((t) => t.tasks.length > 0)
    .map((t) => ({
      id: t.id,
      name: t.name,
      allowedDepartmentIds: t.allowedDepartments.map((a) => a.departmentId),
      tasks: t.tasks.map((tt) => ({
        id: tt.id,
        order: tt.order,
        slaDays: tt.slaDays,
        approverPositionIds: tt.approverRoles.map((r) => r.jobPositionId),
        approverSameDepartment: tt.approverSameDepartment,
        approverDepartmentManager: tt.approverDepartmentManager,
      })),
      fields: t.fields.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        lookupItemIds: f.lookupList?.items.map((i) => i.id) ?? [],
      })),
    }));
  if (templates.length === 0)
    return { ok: false, error: "Κανένα πρότυπο δεν έχει βήματα." };

  const samplePools = await buildSamplePools();
  const plan = planInstances(templates, users, {
    start, end: effectiveEnd, count, completedRatio: ratio, now,
    rng: mulberry32(now.getTime() % 2147483647),
    samplePools,
  });

  let instances = 0, tasks = 0, actions = 0, fieldValues = 0, failedChunks = 0;
  for (let i = 0; i < plan.length; i += CHUNK) {
    const chunk = plan.slice(i, i + CHUNK);
    try {
      // Μετρητές ανά chunk — προστίθενται μόνο αν το transaction επιτύχει
      const c = await prisma.$transaction(async (tx) => {
        const cc = { instances: 0, tasks: 0, actions: 0, fieldValues: 0 };
        for (const p of chunk) {
          const inst = await tx.processInstance.create({
            data: {
              name: p.name,
              processTemplateId: p.templateId,
              startedById: p.startedById,
              startDateTime: p.startDateTime,
              endDateTime: p.endDateTime,
              status: p.status,
              isDemo: true,
              createdAt: p.startDateTime,
            },
          });
          cc.instances++;
          for (const t of p.tasks) {
            const ta = await tx.processTaskAssignment.create({
              data: {
                processInstanceId: inst.id,
                templateTaskId: t.templateTaskId,
                status: t.status,
                currentAssigneeId: t.assigneeId,
                startedAt: t.startedAt,
                completedAt: t.completedAt,
                comment: t.comment,
                createdAt: p.startDateTime,
                possibleAssignees: {
                  create: t.possibleAssigneeIds.map((userId) => ({ userId })),
                },
              },
            });
            cc.tasks++;
            if (t.actions.length) {
              await tx.taskAction.createMany({
                data: t.actions.map((a) => ({
                  taskId: ta.id, userId: a.userId, action: a.action, message: a.message, createdAt: a.createdAt,
                })),
              });
              cc.actions += t.actions.length;
            }
          }
          const fv = p.fieldValues.filter(
            (v) =>
              v.valueString !== null ||
              v.valueNumber !== null ||
              v.valueDate !== null ||
              v.valueBool !== null ||
              v.valueListItemId !== null,
          );
          if (fv.length) {
            await tx.processFieldValue.createMany({
              data: fv.map((v) => ({ processInstanceId: inst.id, ...v })),
            });
            cc.fieldValues += fv.length;
          }
        }
        return cc;
      }, { timeout: 120_000, maxWait: 15_000 });
      instances += c.instances;
      tasks += c.tasks;
      actions += c.actions;
      fieldValues += c.fieldValues;
    } catch (err) {
      failedChunks++;
      console.error(`[data-migration] Αποτυχία chunk ${i / CHUNK + 1}:`, err);
    }
  }

  if (failedChunks > 0 && instances === 0)
    return { ok: false, error: "Η δημιουργία απέτυχε. Δοκιμάστε ξανά ή διαγράψτε τα demo δεδομένα." };

  revalidatePath("/dashboard");
  revalidatePath("/process-instances");
  revalidatePath("/reports/overview");
  return { ok: true, instances, tasks, actions, fieldValues, failedChunks };
}

/** Reset — διαγραφή ΟΛΩΝ των demo δεδομένων. */
export async function deleteDemoData(): Promise<
  { ok: true; instances: number; templates: number } | { ok: false; error: string }
> {
  await requireSuperAdmin();
  const { count: instances } = await prisma.processInstance.deleteMany({ where: { isDemo: true } });
  // Πρότυπα isDemo χωρίς εναπομείναντα instances (πραγματικά πρότυπα δεν αγγίζονται ποτέ)
  const { count: templates } = await prisma.processTemplate.deleteMany({
    where: { isDemo: true, instances: { none: {} } },
  });
  revalidatePath("/dashboard");
  revalidatePath("/process-instances");
  revalidatePath("/process-templates");
  revalidatePath("/reports/overview");
  return { ok: true, instances, templates };
}

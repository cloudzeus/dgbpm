"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { deepseekChat, DeepSeekError } from "@/lib/deepseek";
import { buildPivotViewSql, sanitizeIdentifier } from "@/lib/process-fields/pivot-view";
import type { FieldType, Prisma } from "@prisma/client";

export type FieldInput = {
  id?: string; // present when editing an existing field def
  name: string;
  key: string;
  type: FieldType;
  order: number;
  required: boolean;
  captureTaskOrder: number | null;
  lookupListId: string | null;
};

async function refreshPivotView(tx: Prisma.TransactionClient, templateId: string) {
  const fields = await tx.processFieldDefinition.findMany({
    where: { processTemplateId: templateId, deletedAt: null },
    orderBy: { order: "asc" },
    select: { id: true, key: true, type: true },
  });
  const viewName = `process_data_${sanitizeIdentifier(templateId)}`;
  if (fields.length === 0) {
    await tx.$executeRawUnsafe(`DROP VIEW IF EXISTS \`${viewName}\``);
    return;
  }
  await tx.$executeRawUnsafe(buildPivotViewSql(templateId, fields));
}

/**
 * Δημιουργεί αναλυτική περιγραφή βήματος από μια σύντομη ιδέα, μέσω DeepSeek.
 * Επιστρέφει { ok, text } ή { ok:false, error }.
 */
export async function generateTaskDescription(input: {
  shortDescription: string;
  taskName?: string;
  processName?: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Μη εξουσιοδοτημένη πρόσβαση" };
  try {
    requireRole(session.user.role, [Role.SUPER_ADMIN]);
  } catch {
    return { ok: false, error: "Δεν έχετε δικαίωμα για αυτή την ενέργεια." };
  }

  const idea = input.shortDescription?.trim();
  if (!idea) return { ok: false, error: "Γράψτε πρώτα μια σύντομη περιγραφή." };

  const context = [
    input.processName ? `Διαδικασία: ${input.processName}` : null,
    input.taskName ? `Βήμα/Εργασία: ${input.taskName}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const text = await deepseekChat(
      [
        {
          role: "system",
          content:
            "Είσαι ειδικός σε επιχειρησιακές διαδικασίες (BPM). Γράφεις αναλυτικές, επαγγελματικές οδηγίες " +
            "για ένα βήμα εργασίας, ώστε ο υπεύθυνος να ξέρει ακριβώς τι πρέπει να κάνει. " +
            "Γράφε ΠΑΝΤΑ στα Ελληνικά. Δομή: μια σύντομη εισαγωγική πρόταση για τον σκοπό του βήματος, " +
            "και μετά αριθμημένα βήμα-βήμα βήματα ενεργειών. Πρόσθεσε, όπου βοηθά, σημεία προσοχής, " +
            "απαιτούμενα στοιχεία/έγγραφα και κριτήρια ολοκλήρωσης. Μην προσθέτεις εισαγωγικά σχόλια όπως " +
            "«Ορίστε η περιγραφή». Επίστρεψε μόνο το κείμενο της περιγραφής, σε απλό κείμενο (όχι Markdown σύμβολα).",
        },
        {
          role: "user",
          content: `${context ? context + "\n\n" : ""}Σύντομη ιδέα από τον χρήστη:\n"${idea}"\n\nΓράψε την αναλυτική περιγραφή του βήματος.`,
        },
      ],
      { temperature: 0.5, maxTokens: 1200 },
    );
    return { ok: true, text };
  } catch (err) {
    const message = err instanceof DeepSeekError ? err.message : "Αποτυχία δημιουργίας περιγραφής.";
    console.error("generateTaskDescription", err);
    return { ok: false, error: message };
  }
}

export async function createProcessTemplate(data: {
  name: string;
  description?: string;
  icon: string;
  allowedDepartmentIds: string[];
  tasks: {
    name: string;
    order: number;
    description?: string;
    needFile: boolean;
    mandatory: boolean;
    slaDays?: number | null;
    approverPositionIds: string[];
    notifyOnStartPositionIds?: string[];
    notifyOnCompletePositionIds?: string[];
    approverSameDepartment?: boolean;
    approverDepartmentManager?: boolean;
    notifyOnStartSameDepartment?: boolean;
    notifyOnStartDepartmentManager?: boolean;
    notifyOnCompleteSameDepartment?: boolean;
    notifyOnCompleteDepartmentManager?: boolean;
  }[];
  fields?: FieldInput[];
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);

  const fields = data.fields ?? [];

  await prisma.$transaction(async (tx) => {
    const template = await tx.processTemplate.create({
      data: {
        name: data.name,
        description: data.description ?? undefined,
        icon: data.icon,
        createdById: session.user.id,
        allowedDepartments: {
          create: data.allowedDepartmentIds.map((departmentId) => ({ departmentId })),
        },
        tasks: {
          create: data.tasks.map((t) => ({
            name: t.name,
            order: t.order,
            description: t.description ?? undefined,
            needFile: t.needFile,
            mandatory: t.mandatory,
            slaDays: t.slaDays ?? null,
            approverRoles: {
              create: (t.approverPositionIds ?? []).map((jobPositionId) => ({ jobPositionId })),
            },
            notifyOnStartPositions: {
              create: (t.notifyOnStartPositionIds ?? []).map((jobPositionId) => ({ jobPositionId })),
            },
            notifyOnCompletePositions: {
              create: (t.notifyOnCompletePositionIds ?? []).map((jobPositionId) => ({ jobPositionId })),
            },
            approverSameDepartment: t.approverSameDepartment ?? false,
            approverDepartmentManager: t.approverDepartmentManager ?? false,
            notifyOnStartSameDepartment: t.notifyOnStartSameDepartment ?? false,
            notifyOnStartDepartmentManager: t.notifyOnStartDepartmentManager ?? false,
            notifyOnCompleteSameDepartment: t.notifyOnCompleteSameDepartment ?? false,
            notifyOnCompleteDepartmentManager: t.notifyOnCompleteDepartmentManager ?? false,
          })),
        },
      },
    });

    for (const f of fields) {
      await tx.processFieldDefinition.create({
        data: {
          processTemplateId: template.id,
          name: f.name,
          key: f.key,
          type: f.type,
          order: f.order,
          required: f.required,
          captureTaskOrder: f.captureTaskOrder,
          lookupListId: f.lookupListId ?? undefined,
        },
      });
    }

    await refreshPivotView(tx, template.id);
  });
  revalidatePath("/process-templates");
  revalidatePath("/dashboard");
}

export async function updateProcessTemplate(
  id: string,
  data: {
    name: string;
    description?: string;
    icon: string;
    allowedDepartmentIds: string[];
  tasks: {
    id?: string;
    name: string;
    order: number;
    description?: string;
    needFile: boolean;
    mandatory: boolean;
    slaDays?: number | null;
    approverPositionIds: string[];
    notifyOnStartPositionIds?: string[];
    notifyOnCompletePositionIds?: string[];
    approverSameDepartment?: boolean;
    approverDepartmentManager?: boolean;
    notifyOnStartSameDepartment?: boolean;
    notifyOnStartDepartmentManager?: boolean;
    notifyOnCompleteSameDepartment?: boolean;
    notifyOnCompleteDepartmentManager?: boolean;
  }[];
  fields?: FieldInput[];
}
) {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);

  const fields = data.fields ?? [];

  await prisma.$transaction(async (tx) => {
    await tx.processTemplateDepartment.deleteMany({ where: { processTemplateId: id } });
    await tx.processTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? undefined,
        icon: data.icon,
        allowedDepartments: {
          create: data.allowedDepartmentIds.map((departmentId) => ({ departmentId })),
        },
      },
    });

    const existingTasks = await tx.processTaskTemplate.findMany({
      where: { processTemplateId: id },
      include: { approverRoles: true },
    });
    for (const task of existingTasks) {
      await tx.taskApproverRole.deleteMany({ where: { taskTemplateId: task.id } });
    }
    await tx.processTaskTemplate.deleteMany({ where: { processTemplateId: id } });

    for (const t of data.tasks.sort((a, b) => a.order - b.order)) {
      await tx.processTaskTemplate.create({
        data: {
          processTemplateId: id,
          name: t.name,
          order: t.order,
          description: t.description ?? undefined,
          needFile: t.needFile,
          mandatory: t.mandatory,
          slaDays: t.slaDays ?? null,
          approverRoles: {
            create: (t.approverPositionIds ?? []).map((jobPositionId) => ({ jobPositionId })),
          },
          notifyOnStartPositions: {
            create: (t.notifyOnStartPositionIds ?? []).map((jobPositionId) => ({ jobPositionId })),
          },
          notifyOnCompletePositions: {
            create: (t.notifyOnCompletePositionIds ?? []).map((jobPositionId) => ({ jobPositionId })),
          },
          approverSameDepartment: t.approverSameDepartment ?? false,
          approverDepartmentManager: t.approverDepartmentManager ?? false,
          notifyOnStartSameDepartment: t.notifyOnStartSameDepartment ?? false,
          notifyOnStartDepartmentManager: t.notifyOnStartDepartmentManager ?? false,
          notifyOnCompleteSameDepartment: t.notifyOnCompleteSameDepartment ?? false,
          notifyOnCompleteDepartmentManager: t.notifyOnCompleteDepartmentManager ?? false,
        },
      });
    }

    const existingFields = await tx.processFieldDefinition.findMany({
      where: { processTemplateId: id, deletedAt: null },
    });
    const keepIds = new Set(fields.filter((f) => f.id).map((f) => f.id as string));

    // soft-delete removed fields (preserve historical values)
    for (const ef of existingFields) {
      if (!keepIds.has(ef.id)) {
        await tx.processFieldDefinition.update({ where: { id: ef.id }, data: { deletedAt: new Date() } });
      }
    }

    for (const f of fields) {
      if (f.id) {
        const prev = existingFields.find((e) => e.id === f.id);
        // block type change once values exist
        if (prev && prev.type !== f.type) {
          const used = await tx.processFieldValue.count({ where: { fieldDefinitionId: f.id } });
          if (used > 0) throw new Error(`Δεν επιτρέπεται αλλαγή τύπου στο πεδίο «${f.name}» — υπάρχουν καταχωρημένες τιμές.`);
        }
        await tx.processFieldDefinition.update({
          where: { id: f.id },
          data: { name: f.name, key: f.key, type: f.type, order: f.order, required: f.required, captureTaskOrder: f.captureTaskOrder, lookupListId: f.lookupListId ?? null },
        });
      } else {
        await tx.processFieldDefinition.create({
          data: { processTemplateId: id, name: f.name, key: f.key, type: f.type, order: f.order, required: f.required, captureTaskOrder: f.captureTaskOrder, lookupListId: f.lookupListId ?? undefined },
        });
      }
    }
    await refreshPivotView(tx, id);
  });

  revalidatePath("/process-templates");
  revalidatePath("/dashboard");
}

export async function deleteProcessTemplate(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);

  await prisma.processTemplate.delete({ where: { id } });
  revalidatePath("/process-templates");
  revalidatePath("/dashboard");
}

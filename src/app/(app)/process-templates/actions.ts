"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { deepseekChat, DeepSeekError } from "@/lib/deepseek";
import { buildPivotViewSql, sanitizeIdentifier } from "@/lib/process-fields/pivot-view";
import { slugifyKey } from "@/lib/process-fields/slug";
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

export type ProcessBlueprint = {
  name: string;
  description: string;
  tasks: { name: string; description: string; mandatory: boolean; needFile: boolean }[];
  fields: { name: string; type: FieldType; captureTaskOrder: number | null; required: boolean }[];
};

const BLUEPRINT_FIELD_TYPES: FieldType[] = ["STRING", "TEXT", "NUMBER", "DATE", "FILE_URL", "BOOLEAN"];

/**
 * Επικυρώνει/κανονικοποιεί ένα raw object σε ProcessBlueprint (clamp βημάτων & πεδίων).
 * Επιστρέφει null αν δεν προκύπτει έγκυρο blueprint (0 βήματα).
 */
function normalizeBlueprint(
  obj: Record<string, unknown>,
  tasksLimit: number,
  fieldsLimit: number,
): ProcessBlueprint | null {
  const rawTasks = Array.isArray(obj.tasks) ? obj.tasks : [];
  const tasks = rawTasks
    .slice(0, tasksLimit)
    .map((t) => {
      const tt = t as Record<string, unknown>;
      return {
        name: String(tt.name ?? "").trim(),
        description: String(tt.description ?? "").trim(),
        mandatory: tt.mandatory !== false,
        needFile: tt.needFile === true,
      };
    })
    .filter((t) => t.name);

  if (tasks.length === 0) return null;

  const rawFields = Array.isArray(obj.fields) ? obj.fields : [];
  const fields = rawFields
    .slice(0, fieldsLimit)
    .map((f) => {
      const ff = f as Record<string, unknown>;
      const type = BLUEPRINT_FIELD_TYPES.includes(ff.type as FieldType)
        ? (ff.type as FieldType)
        : "STRING";
      const rawOrder = Number(ff.captureTaskOrder);
      const captureTaskOrder =
        Number.isInteger(rawOrder) && rawOrder >= 0 && rawOrder < tasks.length ? rawOrder : 0;
      return {
        name: String(ff.name ?? "").trim(),
        type,
        captureTaskOrder,
        required: ff.required === true,
      };
    })
    .filter((f) => f.name);

  return {
    name: String(obj.name ?? "").trim(),
    description: String(obj.description ?? "").trim(),
    tasks,
    fields,
  };
}

/**
 * Από μια περιγραφή, προτείνει ολόκληρη διαδικασία (βήματα + πεδία) μέσω DeepSeek.
 * Επιστρέφει δομημένο blueprint που ο wizard εφαρμόζει στα βήματά του.
 */
export async function generateProcessBlueprint(input: {
  description: string;
}): Promise<{ ok: true; blueprint: ProcessBlueprint } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Μη εξουσιοδοτημένη πρόσβαση" };
  try {
    requireRole(session.user.role, [Role.SUPER_ADMIN]);
  } catch {
    return { ok: false, error: "Δεν έχετε δικαίωμα για αυτή την ενέργεια." };
  }

  const idea = input.description?.trim();
  if (!idea) return { ok: false, error: "Γράψτε πρώτα μια περιγραφή της διαδικασίας." };

  const system =
    "Είσαι ειδικός σχεδιαστής επιχειρησιακών διαδικασιών (BPM). Από την περιγραφή του χρήστη " +
    "σχεδιάζεις μια πλήρη διαδικασία και επιστρέφεις ΜΟΝΟ έγκυρο JSON (χωρίς markdown, χωρίς σχόλια) " +
    "με αυτή ακριβώς τη δομή:\n" +
    '{"name": string, "description": string, "tasks": [{"name": string, "description": string, ' +
    '"mandatory": boolean, "needFile": boolean}], "fields": [{"name": string, "type": string, ' +
    '"captureTaskOrder": number, "required": boolean}]}\n' +
    "Κανόνες: Όλα τα κείμενα στα Ελληνικά. 2 έως 6 βήματα. 2 έως 8 πεδία. " +
    'Το "type" κάθε πεδίου είναι ΕΝΑ από: "STRING","TEXT","NUMBER","DATE","FILE_URL","BOOLEAN". ' +
    'Το "captureTaskOrder" είναι ο δείκτης (0-based) του βήματος στο οποίο συμπληρώνεται το πεδίο, ' +
    "μέσα στα όρια των tasks. Επίστρεψε ΜΟΝΟ το JSON object.";

  let raw: string;
  try {
    raw = await deepseekChat(
      [
        { role: "system", content: system },
        { role: "user", content: `Περιγραφή διαδικασίας:\n"${idea}"\n\nΣχεδίασε τη διαδικασία ως JSON.` },
      ],
      { temperature: 0.4, maxTokens: 2000 },
    );
  } catch (err) {
    const message = err instanceof DeepSeekError ? err.message : "Αποτυχία δημιουργίας διαδικασίας.";
    console.error("generateProcessBlueprint", err);
    return { ok: false, error: message };
  }

  const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "Το AI δεν επέστρεψε έγκυρη δομή. Δοκιμάστε ξανά." };
  }

  const obj = parsed as Record<string, unknown>;
  const blueprint = normalizeBlueprint(obj, 8, 12);

  if (!blueprint) {
    return { ok: false, error: "Το AI δεν πρότεινε βήματα. Δοκιμάστε πιο συγκεκριμένη περιγραφή." };
  }

  return { ok: true, blueprint };
}

/**
 * Από μια περιγραφή ΕΠΙΧΕΙΡΗΣΗΣ, προτείνει 3–6 ξεχωριστές εσωτερικές διαδικασίες μέσω DeepSeek.
 * Ο διαχειριστής επιλέγει ποιες θα δημιουργηθούν ως πρότυπα διαδικασιών.
 */
export async function generateBusinessProcesses(input: {
  description: string;
}): Promise<{ ok: true; processes: ProcessBlueprint[] } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Μη εξουσιοδοτημένη πρόσβαση" };
  try {
    requireRole(session.user.role, [Role.SUPER_ADMIN]);
  } catch {
    return { ok: false, error: "Δεν έχετε δικαίωμα για αυτή την ενέργεια." };
  }

  const idea = input.description?.trim();
  if (!idea) return { ok: false, error: "Γράψτε πρώτα μια περιγραφή της επιχείρησης." };

  const system =
    "Είσαι ειδικός σύμβουλος επιχειρησιακών διαδικασιών (BPM). Από την περιγραφή μιας ΕΠΙΧΕΙΡΗΣΗΣ " +
    "προτείνεις 3 έως 6 ΞΕΧΩΡΙΣΤΕΣ εσωτερικές διαδικασίες που θα βοηθούσαν την οργάνωσή της και " +
    "επιστρέφεις ΜΟΝΟ έγκυρο JSON (χωρίς markdown, χωρίς σχόλια) με αυτή ακριβώς τη δομή:\n" +
    '{"processes": [{"name": string, "description": string, "tasks": [{"name": string, ' +
    '"description": string, "mandatory": boolean, "needFile": boolean}], "fields": [{"name": string, ' +
    '"type": string, "captureTaskOrder": number, "required": boolean}]}]}\n' +
    "Κανόνες: Όλα τα κείμενα στα Ελληνικά. 3 έως 6 διαδικασίες. Κάθε διαδικασία 2 έως 6 βήματα και " +
    "έως 8 πεδία. " +
    'Το "type" κάθε πεδίου είναι ΕΝΑ από: "STRING","TEXT","NUMBER","DATE","FILE_URL","BOOLEAN". ' +
    'Το "captureTaskOrder" είναι ο δείκτης (0-based) του βήματος στο οποίο συμπληρώνεται το πεδίο, ' +
    "μέσα στα όρια των tasks της ίδιας διαδικασίας. Επίστρεψε ΜΟΝΟ το JSON object.";

  let raw: string;
  try {
    raw = await deepseekChat(
      [
        { role: "system", content: system },
        { role: "user", content: `Περιγραφή επιχείρησης:\n"${idea}"\n\nΠρότεινε τις διαδικασίες ως JSON.` },
      ],
      { temperature: 0.5, maxTokens: 4000 },
    );
  } catch (err) {
    const message = err instanceof DeepSeekError ? err.message : "Αποτυχία δημιουργίας διαδικασιών.";
    console.error("generateBusinessProcesses", err);
    return { ok: false, error: message };
  }

  const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "Το AI δεν επέστρεψε έγκυρη δομή. Δοκιμάστε ξανά." };
  }

  const obj = parsed as Record<string, unknown>;
  const rawProcesses = Array.isArray(obj.processes) ? obj.processes : [];
  const processes = rawProcesses
    .map((p) => normalizeBlueprint((p ?? {}) as Record<string, unknown>, 6, 8))
    .filter((p): p is ProcessBlueprint => p !== null)
    .slice(0, 6);

  if (processes.length === 0) {
    return {
      ok: false,
      error: "Το AI δεν πρότεινε διαδικασίες. Δοκιμάστε πιο αναλυτική περιγραφή.",
    };
  }

  return { ok: true, processes };
}

/**
 * Δημιουργεί ένα πρότυπο διαδικασίας για κάθε επιλεγμένο blueprint,
 * επαναχρησιμοποιώντας τη λογική του createProcessTemplate.
 */
export async function createProcessTemplatesFromBlueprints(
  blueprints: ProcessBlueprint[],
): Promise<{ created: number }> {
  const session = await auth();
  if (!session?.user) throw new Error("Μη εξουσιοδοτημένη πρόσβαση");
  requireRole(session.user.role, [Role.SUPER_ADMIN]);

  let created = 0;
  for (const bp of blueprints) {
    const usedKeys = new Set<string>();
    const fields: FieldInput[] = bp.fields.map((f, i) => {
      let key = slugifyKey(f.name);
      if (usedKeys.has(key)) {
        let n = 2;
        while (usedKeys.has(`${key}_${n}`)) n++;
        key = `${key}_${n}`;
      }
      usedKeys.add(key);
      return {
        name: f.name,
        key,
        type: f.type,
        order: i,
        required: f.required,
        captureTaskOrder: f.captureTaskOrder,
        lookupListId: null,
      };
    });

    await createProcessTemplate({
      name: bp.name,
      description: bp.description || undefined,
      icon: "FiFileText",
      allowedDepartmentIds: [],
      tasks: bp.tasks.map((t, i) => ({
        name: t.name,
        order: i,
        description: t.description || undefined,
        needFile: t.needFile,
        mandatory: t.mandatory,
        slaDays: null,
        approverPositionIds: [],
        notifyOnStartPositionIds: [],
        notifyOnCompletePositionIds: [],
        approverSameDepartment: false,
        approverDepartmentManager: false,
        notifyOnStartSameDepartment: false,
        notifyOnStartDepartmentManager: false,
        notifyOnCompleteSameDepartment: false,
        notifyOnCompleteDepartmentManager: false,
        notifyOnStartInitiator: false,
        notifyOnCompleteInitiator: true,
      })),
      fields,
    });
    created++;
  }

  revalidatePath("/process-templates");
  return { created };
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
    notifyOnStartInitiator?: boolean;
    notifyOnCompleteInitiator?: boolean;
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
            notifyOnStartInitiator: t.notifyOnStartInitiator ?? false,
            notifyOnCompleteInitiator: t.notifyOnCompleteInitiator ?? true,
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
    notifyOnStartInitiator?: boolean;
    notifyOnCompleteInitiator?: boolean;
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
          notifyOnStartInitiator: t.notifyOnStartInitiator ?? false,
          notifyOnCompleteInitiator: t.notifyOnCompleteInitiator ?? true,
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

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
import type { EditableField, PriorField, StoredFieldValue } from "@/components/process-fields/task-fields-form";
import { resolveEntityLabels } from "@/lib/entities/resolve";
import { treeOrder } from "@/lib/entities/tree";
import { lookupItemDisplay } from "@/lib/lookup-lists/display";

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

  // Custom data fields: definitions for this template + captured values for this instance.
  const fieldDefs = await prisma.processFieldDefinition.findMany({
    where: { processTemplateId: instance.processTemplateId, deletedAt: null },
    orderBy: { order: "asc" },
    include: { lookupList: { include: { items: { orderBy: { order: "asc" } } } } },
  });
  const fieldValues = await prisma.processFieldValue.findMany({
    where: { processInstanceId: instance.id },
    include: { listItem: { select: { label: true, value: true, extra: true } } },
  });
  const valueByField = new Map(fieldValues.map((v) => [v.fieldDefinitionId, v]));

  // ENTITY: επίλυση ετικετών «κωδικός — όνομα» server-side (batched ανά kind).
  const defById = new Map(fieldDefs.map((f) => [f.id, f]));
  const entityPairs = fieldValues.flatMap((v) => {
    const def = defById.get(v.fieldDefinitionId);
    return def?.type === "ENTITY" && def.entityKind && v.valueEntityId
      ? [{ kind: def.entityKind, id: v.valueEntityId }]
      : [];
  });
  const entityLabels = entityPairs.length > 0 ? await resolveEntityLabels(entityPairs) : new Map<string, string>();

  function storedValue(fieldId: string): StoredFieldValue {
    const v = valueByField.get(fieldId);
    if (!v) return null;
    const def = defById.get(fieldId);
    return {
      ...v,
      // Η εμφάνιση της επιλεγμένης τιμής ακολουθεί τη στήλη εμφάνισης του πεδίου.
      listItem: v.listItem
        ? { label: lookupItemDisplay(v.listItem, def?.lookupDisplayKey) }
        : v.listItem,
      entityLabel: v.valueEntityId ? entityLabels.get(v.valueEntityId) ?? null : null,
    };
  }

  const taskFields: Record<string, { editable: EditableField[]; readOnly: PriorField[] }> = {};
  for (const t of instance.tasks) {
    const order = t.templateTask.order;
    const editable: EditableField[] = fieldDefs
      .filter((f) => f.captureTaskOrder === order)
      .map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        required: f.required,
        options: f.lookupList
          ? treeOrder(f.lookupList.items).map((it) => ({
              id: it.id,
              label: `${"— ".repeat(it.depth)}${lookupItemDisplay(it, f.lookupDisplayKey)}`,
            }))
          : [],
        entityKind: f.entityKind,
        value: storedValue(f.id),
      }));
    const readOnly: PriorField[] = fieldDefs
      .filter((f) => f.captureTaskOrder != null && f.captureTaskOrder < order)
      .map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        value: storedValue(f.id),
      }));
    taskFields[t.id] = { editable, readOnly };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/process-instances">← Πίσω</Link>
            </Button>
          </div>
          <h1 className="ui-page-title mt-2">{instance.name}</h1>
          <p className="ui-page-subtitle flex items-center gap-2">
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
        taskFields={taskFields}
      />
    </div>
  );
}

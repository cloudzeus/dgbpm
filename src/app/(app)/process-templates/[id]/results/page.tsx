import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { ResultsClient } from "./results-client";
import { resolveEntityLabels } from "@/lib/entities/resolve";

export default async function TemplateResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "MANAGER") {
    redirect("/dashboard");
  }

  const template = await prisma.processTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      fields: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        select: { id: true, name: true, type: true, entityKind: true },
      },
    },
  });
  if (!template) notFound();

  const instances = await prisma.processInstance.findMany({
    where: { processTemplateId: id },
    orderBy: { startDateTime: "desc" },
    select: {
      id: true,
      name: true,
      fieldValues: {
        select: {
          fieldDefinitionId: true,
          valueString: true,
          valueNumber: true,
          valueDate: true,
          valueBool: true,
          valueEntityId: true,
          listItem: { select: { label: true } },
        },
      },
    },
  });

  // ENTITY: επίλυση ετικετών «κωδικός — όνομα» server-side, batched ανά kind.
  const kindByField = new Map(
    template.fields.filter((f) => f.type === "ENTITY" && f.entityKind).map((f) => [f.id, f.entityKind!])
  );
  const entityPairs = instances.flatMap((inst) =>
    inst.fieldValues.flatMap((v) => {
      const kind = kindByField.get(v.fieldDefinitionId);
      return kind && v.valueEntityId ? [{ kind, id: v.valueEntityId }] : [];
    })
  );
  const entityLabels = entityPairs.length > 0 ? await resolveEntityLabels(entityPairs) : new Map<string, string>();
  const instancesWithLabels = instances.map((inst) => ({
    ...inst,
    fieldValues: inst.fieldValues.map((v) => ({
      ...v,
      entityLabel: v.valueEntityId ? entityLabels.get(v.valueEntityId) ?? null : null,
    })),
  }));

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="ui-page-title">Αποτελέσματα: {template.name}</h1>
        <p className="ui-page-subtitle">
          Καταχωρημένα στοιχεία ανά διαδικασία με εξαγωγή σε Excel / PDF / Word.
        </p>
      </div>
      <ResultsClient
        title={`Αποτελέσματα-${template.name}`}
        fields={template.fields}
        instances={instancesWithLabels}
      />
    </div>
  );
}

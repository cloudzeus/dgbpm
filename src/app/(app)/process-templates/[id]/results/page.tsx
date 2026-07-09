import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { ResultsClient } from "./results-client";

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
        select: { id: true, name: true, type: true },
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
          listItem: { select: { label: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Αποτελέσματα: {template.name}</h1>
        <p className="text-muted-foreground text-sm">
          Καταχωρημένα στοιχεία ανά διαδικασία με εξαγωγή σε Excel / PDF / Word.
        </p>
      </div>
      <ResultsClient
        title={`Αποτελέσματα-${template.name}`}
        fields={template.fields}
        instances={instances}
      />
    </div>
  );
}

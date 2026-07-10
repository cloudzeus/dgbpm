"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ProcessIcon } from "@/lib/process-icons";
import { taskStatusMeta } from "@/lib/process-status";

export type MyTaskRow = {
  id: string;
  processInstanceId: string;
  processInstanceName: string;
  processIcon: string;
  taskName: string;
  mandatory: boolean;
  status: string;
  startedByName: string;
};

export function MyTasksTable({ tasks }: { tasks: MyTaskRow[] }) {
  const router = useRouter();

  const columns: DataTableColumn<MyTaskRow>[] = [
    {
      key: "process",
      header: "Διαδικασία",
      cell: (t) => (
        <>
          <ProcessIcon icon={t.processIcon} className="size-4 inline mr-1" />
          {t.processInstanceName}
        </>
      ),
    },
    {
      key: "task",
      header: "Εργασία",
      cell: (t) => (
        <>
          {t.taskName}
          {t.mandatory && (
            <Badge variant="success" className="ml-1 text-xs">
              Υποχρεωτικό
            </Badge>
          )}
        </>
      ),
    },
    {
      key: "status",
      header: "Κατάσταση",
      cell: (t) => (
        <Badge
          variant={
            t.status === "APPROVED"
              ? "success"
              : t.status === "REJECTED"
                ? "destructive"
                : t.status === "IN_PROGRESS"
                  ? "info"
                  : "warning"
          }
        >
          {taskStatusMeta(t.status).label}
        </Badge>
      ),
    },
    {
      key: "startedBy",
      header: "Εκκίνηση από",
      cell: (t) => t.startedByName,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={tasks}
      rowKey={(t) => t.id}
      actions={(t) => [
        {
          label: "Άνοιγμα",
          onSelect: () => router.push(`/process-instances/${t.processInstanceId}`),
        },
      ]}
      emptyMessage="Δεν υπάρχουν εκκρεμείς εργασίες που σας έχουν ανατεθεί."
    />
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  exportReportByTaskToExcel,
  exportReportByTaskToPdf,
  type ReportByTaskRow,
} from "@/lib/report-export";
import { FiDownload, FiFileText } from "react-icons/fi";

const TITLE = "Εργασίες ανά Εργασία";

const columns: DataTableColumn<ReportByTaskRow>[] = [
  { key: "taskName", header: "Εργασία", cell: (row) => <span className="font-medium">{row.taskName}</span> },
  { key: "processTemplateName", header: "Πρότυπο Διαδικασίας", cell: (row) => row.processTemplateName },
  { key: "totalAssignments", header: "Σύνολο", align: "right", cell: (row) => row.totalAssignments },
  { key: "pending", header: "Σε αναμονή", align: "right", cell: (row) => row.pending },
  { key: "inProgress", header: "Σε εξέλιξη", align: "right", cell: (row) => row.inProgress },
  { key: "approved", header: "Εγκρίθηκε", align: "right", cell: (row) => row.approved },
  { key: "rejected", header: "Απορρίφθηκε", align: "right", cell: (row) => row.rejected },
  { key: "skipped", header: "Παραλείφθηκε", align: "right", cell: (row) => row.skipped },
];

export function ReportByTaskClient({ data }: { data: ReportByTaskRow[] }) {
  const handlePdf = () => exportReportByTaskToPdf(data, TITLE);
  const handleExcel = () => exportReportByTaskToExcel(data, TITLE);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>{TITLE}</CardTitle>
          <CardDescription>
            Χρήση προτύπων εργασιών: πλήθος ανά κατάσταση (σε αναμονή, σε εξέλιξη, εγκρίθηκε, απορρίφθηκε, παραλείφθηκε).
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePdf}>
            <FiFileText className="size-4" />
            Εξαγωγή PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExcel}>
            <FiDownload className="size-4" />
            Εξαγωγή Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={data}
          rowKey={(row) => String(row.templateTaskId ?? row.taskName)}
          emptyMessage="Χωρίς δεδομένα"
        />
      </CardContent>
    </Card>
  );
}

export function ReportByTaskSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-96 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

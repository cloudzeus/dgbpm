"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  exportReportByUserToExcel,
  exportReportByUserToPdf,
  type ReportByUserRow,
} from "@/lib/report-export";
import { FiDownload, FiFileText } from "react-icons/fi";

const TITLE = "Διαδικασίες ανά Χρήστη";

const columns: DataTableColumn<ReportByUserRow>[] = [
  { key: "userName", header: "Χρήστης", cell: (row) => <span className="font-medium">{row.userName}</span> },
  { key: "email", header: "Email", cell: (row) => row.email },
  { key: "role", header: "Ρόλος", cell: (row) => row.role },
  { key: "processesStarted", header: "Διαδικασίες που ξεκίνησαν", align: "right", cell: (row) => row.processesStarted },
  { key: "tasksAssigned", header: "Εργασίες που ανατέθηκαν", align: "right", cell: (row) => row.tasksAssigned },
  { key: "tasksApproved", header: "Εγκρίθηκαν", align: "right", cell: (row) => row.tasksApproved },
  { key: "tasksRejected", header: "Απορρίφθηκαν", align: "right", cell: (row) => row.tasksRejected },
  { key: "tasksInProgress", header: "Σε εξέλιξη", align: "right", cell: (row) => row.tasksInProgress },
  { key: "tasksPending", header: "Σε αναμονή", align: "right", cell: (row) => row.tasksPending },
];

export function ReportByUserClient({ data }: { data: ReportByUserRow[] }) {
  const handlePdf = () => exportReportByUserToPdf(data, TITLE);
  const handleExcel = () => exportReportByUserToExcel(data, TITLE);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>{TITLE}</CardTitle>
          <CardDescription>Δραστηριότητα ανά χρήστη: διαδικασίες που ξεκίνησαν, εργασίες που ανατέθηκαν, εγκρίθηκαν, απορρίφθηκαν.</CardDescription>
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
          rowKey={(row) => String(row.userId ?? row.email)}
          emptyMessage="Χωρίς δεδομένα"
        />
      </CardContent>
    </Card>
  );
}

export function ReportByUserSkeleton() {
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

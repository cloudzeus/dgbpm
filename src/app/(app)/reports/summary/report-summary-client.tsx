"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  exportReportSummaryToExcel,
  exportReportSummaryToPdf,
  type ReportSummaryRow,
} from "@/lib/report-export";
import { FiDownload, FiFileText } from "react-icons/fi";

const TITLE = "Σύνοψη Διαδικασιών";

const columns: DataTableColumn<ReportSummaryRow>[] = [
  { key: "instanceName", header: "Διαδικασία", cell: (row) => <span className="font-medium">{row.instanceName}</span> },
  { key: "processTemplateName", header: "Πρότυπο", cell: (row) => row.processTemplateName },
  { key: "status", header: "Κατάσταση", cell: (row) => row.status },
  { key: "startedByName", header: "Εκκίνηση από", cell: (row) => row.startedByName },
  { key: "startDate", header: "Ημερομηνία έναρξης", cell: (row) => row.startDate },
  { key: "endDate", header: "Ημερομηνία λήξης", cell: (row) => row.endDate ?? "—" },
  { key: "taskCount", header: "Εργασίες", align: "right", cell: (row) => row.taskCount },
  { key: "completedTaskCount", header: "Ολοκληρώθηκαν", align: "right", cell: (row) => row.completedTaskCount },
];

export function ReportSummaryClient({ data }: { data: ReportSummaryRow[] }) {
  const handlePdf = () => exportReportSummaryToPdf(data, TITLE);
  const handleExcel = () => exportReportSummaryToExcel(data, TITLE);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>{TITLE}</CardTitle>
          <CardDescription>Διαδικασίες: πρότυπο, κατάσταση, εκκίνηση από, ημερομηνίες και ολοκλήρωση εργασιών.</CardDescription>
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
          rowKey={(row) => String(row.instanceId ?? row.instanceName)}
          emptyMessage="Χωρίς δεδομένα"
        />
      </CardContent>
    </Card>
  );
}

export function ReportSummarySkeleton() {
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

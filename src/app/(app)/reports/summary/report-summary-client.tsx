"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  exportReportSummaryToExcel,
  exportReportSummaryToPdf,
  type ReportSummaryRow,
} from "@/lib/report-export";
import { FiDownload, FiFileText } from "react-icons/fi";

const TITLE = "Σύνοψη Διαδικασιών";

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Διαδικασία</TableHead>
              <TableHead>Πρότυπο</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead>Εκκίνηση από</TableHead>
              <TableHead>Ημερομηνία έναρξης</TableHead>
              <TableHead>Ημερομηνία λήξης</TableHead>
              <TableHead className="text-right">Εργασίες</TableHead>
              <TableHead className="text-right">Ολοκληρώθηκαν</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Χωρίς δεδομένα
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.instanceId ?? row.instanceName}>
                  <TableCell className="font-medium">{row.instanceName}</TableCell>
                  <TableCell>{row.processTemplateName}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.startedByName}</TableCell>
                  <TableCell>{row.startDate}</TableCell>
                  <TableCell>{row.endDate ?? "—"}</TableCell>
                  <TableCell className="text-right">{row.taskCount}</TableCell>
                  <TableCell className="text-right">{row.completedTaskCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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

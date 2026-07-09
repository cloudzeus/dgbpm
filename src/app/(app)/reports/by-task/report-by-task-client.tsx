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
  exportReportByTaskToExcel,
  exportReportByTaskToPdf,
  type ReportByTaskRow,
} from "@/lib/report-export";
import { FiDownload, FiFileText } from "react-icons/fi";

const TITLE = "Εργασίες ανά Εργασία";

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Εργασία</TableHead>
              <TableHead>Πρότυπο Διαδικασίας</TableHead>
              <TableHead className="text-right">Σύνολο</TableHead>
              <TableHead className="text-right">Σε αναμονή</TableHead>
              <TableHead className="text-right">Σε εξέλιξη</TableHead>
              <TableHead className="text-right">Εγκρίθηκε</TableHead>
              <TableHead className="text-right">Απορρίφθηκε</TableHead>
              <TableHead className="text-right">Παραλείφθηκε</TableHead>
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
              data.map((row, i) => (
                <TableRow key={row.templateTaskId ?? `${row.taskName}-${i}`}>
                  <TableCell className="font-medium">{row.taskName}</TableCell>
                  <TableCell>{row.processTemplateName}</TableCell>
                  <TableCell className="text-right">{row.totalAssignments}</TableCell>
                  <TableCell className="text-right">{row.pending}</TableCell>
                  <TableCell className="text-right">{row.inProgress}</TableCell>
                  <TableCell className="text-right">{row.approved}</TableCell>
                  <TableCell className="text-right">{row.rejected}</TableCell>
                  <TableCell className="text-right">{row.skipped}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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

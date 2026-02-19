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

const TITLE = "Tasks by Task";

export function ReportByTaskClient({ data }: { data: ReportByTaskRow[] }) {
  const handlePdf = () => exportReportByTaskToPdf(data, TITLE);
  const handleExcel = () => exportReportByTaskToExcel(data, TITLE);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>{TITLE}</CardTitle>
          <CardDescription>
            Task template usage: counts by status (pending, in progress, approved, rejected, skipped).
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePdf}>
            <FiFileText className="size-4" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExcel}>
            <FiDownload className="size-4" />
            Export Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Process template</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead className="text-right">In progress</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead className="text-right">Rejected</TableHead>
              <TableHead className="text-right">Skipped</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No data
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

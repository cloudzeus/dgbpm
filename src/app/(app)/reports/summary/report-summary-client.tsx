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

const TITLE = "Process Summary";

export function ReportSummaryClient({ data }: { data: ReportSummaryRow[] }) {
  const handlePdf = () => exportReportSummaryToPdf(data, TITLE);
  const handleExcel = () => exportReportSummaryToExcel(data, TITLE);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>{TITLE}</CardTitle>
          <CardDescription>Process instances: template, status, started by, dates, and task completion.</CardDescription>
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
              <TableHead>Instance</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started by</TableHead>
              <TableHead>Start date</TableHead>
              <TableHead>End date</TableHead>
              <TableHead className="text-right">Tasks</TableHead>
              <TableHead className="text-right">Completed</TableHead>
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

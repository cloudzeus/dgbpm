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
  exportReportByUserToExcel,
  exportReportByUserToPdf,
  type ReportByUserRow,
} from "@/lib/report-export";
import { FiDownload, FiFileText } from "react-icons/fi";

const TITLE = "Processes by User";

export function ReportByUserClient({ data }: { data: ReportByUserRow[] }) {
  const handlePdf = () => exportReportByUserToPdf(data, TITLE);
  const handleExcel = () => exportReportByUserToExcel(data, TITLE);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>{TITLE}</CardTitle>
          <CardDescription>Activity per user: processes started, tasks assigned, approved, rejected.</CardDescription>
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
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Processes started</TableHead>
              <TableHead className="text-right">Tasks assigned</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead className="text-right">Rejected</TableHead>
              <TableHead className="text-right">In progress</TableHead>
              <TableHead className="text-right">Pending</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No data
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.userId ?? row.email}>
                  <TableCell className="font-medium">{row.userName}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.role}</TableCell>
                  <TableCell className="text-right">{row.processesStarted}</TableCell>
                  <TableCell className="text-right">{row.tasksAssigned}</TableCell>
                  <TableCell className="text-right">{row.tasksApproved}</TableCell>
                  <TableCell className="text-right">{row.tasksRejected}</TableCell>
                  <TableCell className="text-right">{row.tasksInProgress}</TableCell>
                  <TableCell className="text-right">{row.tasksPending}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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

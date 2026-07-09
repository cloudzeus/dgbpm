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

const TITLE = "Διαδικασίες ανά Χρήστη";

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Χρήστης</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ρόλος</TableHead>
              <TableHead className="text-right">Διαδικασίες που ξεκίνησαν</TableHead>
              <TableHead className="text-right">Εργασίες που ανατέθηκαν</TableHead>
              <TableHead className="text-right">Εγκρίθηκαν</TableHead>
              <TableHead className="text-right">Απορρίφθηκαν</TableHead>
              <TableHead className="text-right">Σε εξέλιξη</TableHead>
              <TableHead className="text-right">Σε αναμονή</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Χωρίς δεδομένα
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

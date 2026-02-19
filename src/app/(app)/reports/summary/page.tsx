import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getReportSummaryData } from "../reports-data";
import { ReportSummaryClient } from "./report-summary-client";
import { Suspense } from "react";
import { ReportSummarySkeleton } from "./report-summary-client";

export default async function ReportSummaryPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  const data = await getReportSummaryData();
  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold text-zinc-200">Reports</h1>
      <Suspense fallback={<ReportSummarySkeleton />}>
        <ReportSummaryClient data={data} />
      </Suspense>
    </div>
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getReportByTaskData } from "../reports-data";
import { ReportByTaskClient } from "./report-by-task-client";
import { Suspense } from "react";
import { ReportByTaskSkeleton } from "./report-by-task-client";

export default async function ReportByTaskPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  const data = await getReportByTaskData();
  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold text-zinc-200">Reports</h1>
      <Suspense fallback={<ReportByTaskSkeleton />}>
        <ReportByTaskClient data={data} />
      </Suspense>
    </div>
  );
}

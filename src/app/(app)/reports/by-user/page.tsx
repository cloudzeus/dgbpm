import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getReportByUserData } from "../reports-data";
import { ReportByUserClient } from "./report-by-user-client";
import { Suspense } from "react";
import { ReportByUserSkeleton } from "./report-by-user-client";

export default async function ReportByUserPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  const data = await getReportByUserData();
  return (
    <div className="space-y-6 p-4">
      <h1 className="ui-page-title">Αναφορές</h1>
      <Suspense fallback={<ReportByUserSkeleton />}>
        <ReportByUserClient data={data} />
      </Suspense>
    </div>
  );
}

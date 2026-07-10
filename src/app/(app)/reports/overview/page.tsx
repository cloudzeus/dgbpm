import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getOverviewData } from "../overview-data";
import { OverviewClient } from "./overview-client";

export default async function ReportsOverviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "MANAGER") {
    redirect("/dashboard");
  }
  const data = await getOverviewData();
  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="ui-page-title">Επισκόπηση</h1>
        <p className="ui-page-subtitle">
          Κέντρο ελέγχου: καθυστερήσεις, απόδοση, σημεία συμφόρησης και φόρτος εργασίας.
        </p>
      </div>
      <OverviewClient data={data} />
    </div>
  );
}

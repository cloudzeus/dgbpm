import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMailgunStats } from "../mailgun-data";
import { MailgunClient } from "./mailgun-client";

const ALLOWED_DAYS = [7, 30, 90];

export default async function ReportsMailgunPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "MANAGER") {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const parsed = Number(sp.days);
  const days = ALLOWED_DAYS.includes(parsed) ? parsed : 30;

  const data = await getMailgunStats(days);

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="ui-page-title">Emails ενημέρωσης (Mailgun)</h1>
        <p className="ui-page-subtitle">
          Στατιστικά αποστολής: παραδόθηκαν, ανοίχτηκαν, κλικ και αποτυχίες.
        </p>
      </div>
      <MailgunClient data={data} />
    </div>
  );
}

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { CompanyClient } from "./company-client";

export default async function CompanyPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  try {
    requireRole(session.user.role, [Role.SUPER_ADMIN]);
  } catch {
    redirect("/dashboard");
  }

  const company = await prisma.company.findFirst({
    include: { activities: { orderBy: [{ isPrimary: "desc" }, { code: "asc" }] } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ui-page-title">Εταιρία</h1>
        <p className="ui-page-subtitle">
          Στοιχεία της εταιρίας μας. Συμπληρώστε το ΑΦΜ και πατήστε «Λήψη από ΑΑΔΕ» για
          αυτόματη συμπλήρωση των στοιχείων και των ΚΑΔ.
        </p>
      </div>
      <CompanyClient company={company} />
    </div>
  );
}

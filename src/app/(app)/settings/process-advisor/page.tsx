import { auth } from "@/auth";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { ProcessAdvisorClient } from "./process-advisor-client";

export default async function ProcessAdvisorPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  try {
    requireRole(session.user.role, [Role.SUPER_ADMIN]);
  } catch {
    redirect("/dashboard");
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="ui-page-title">AI Σύμβουλος Διαδικασιών</h1>
        <p className="ui-page-subtitle">
          Περιγράψτε την επιχείρησή σας και το AI θα προτείνει εσωτερικές διαδικασίες, λαμβάνοντας
          υπόψη και τους ΚΑΔ της εταιρίας (Ρυθμίσεις → Εταιρία) που περιγράφουν το αντικείμενό της.
          Επιλέξτε ποιες θέλετε να δημιουργηθούν ως πρότυπα διαδικασιών.
        </p>
      </div>
      <ProcessAdvisorClient />
    </div>
  );
}

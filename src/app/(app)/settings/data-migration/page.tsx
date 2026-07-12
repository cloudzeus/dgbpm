import { auth } from "@/auth";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getMigrationOverview } from "./actions";
import { DataMigrationWizard } from "./wizard";

export default async function DataMigrationPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  try {
    requireRole(session.user.role, [Role.SUPER_ADMIN]);
  } catch {
    redirect("/dashboard");
  }

  const overview = await getMigrationOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ui-page-title">Data Migration</h1>
        <p className="ui-page-subtitle">
          Δημιουργία ρεαλιστικών demo διαδικασιών από τα υπάρχοντα δεδομένα (χρήστες, τμήματα,
          πρότυπα, λίστες, διασυνδέσεις) για να γεμίσουν οι πίνακες ελέγχου και οι αναφορές.
          Δεν αποστέλλονται ειδοποιήσεις και τα demo δεδομένα διαγράφονται με ένα κλικ.
        </p>
      </div>
      <DataMigrationWizard overview={overview} />
    </div>
  );
}

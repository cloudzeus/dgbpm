import { auth } from "@/auth";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { ENTITY_KINDS } from "@/lib/entities/registry";
import { listEntities, availableSyncSources } from "./actions";
import { EntitiesClient, type EntityRow } from "./entities-client";

export default async function EntitiesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  try {
    requireRole(session.user.role, [Role.SUPER_ADMIN, Role.ADMIN]);
  } catch {
    redirect("/dashboard");
  }

  const firstKind = ENTITY_KINDS[0];
  const [initial, syncSources] = await Promise.all([
    listEntities(firstKind),
    availableSyncSources(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ui-page-title">Οντότητες</h1>
        <p className="ui-page-subtitle">
          Λίστες οντοτήτων ευθυγραμμισμένες με το ERP (προμηθευτές, πελάτες, προϊόντα,
          κατηγορίες, χρώματα, μεγέθη). Υποστηρίζεται συγχρονισμός από SoftOne / WooCommerce
          και μαζική εισαγωγή/εξαγωγή μέσω xlsx.
        </p>
      </div>
      <EntitiesClient
        initialKind={firstKind}
        initialRows={initial.rows as unknown as EntityRow[]}
        syncSources={syncSources}
      />
    </div>
  );
}

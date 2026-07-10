import { auth } from "@/auth";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getConnectors } from "./actions";
import { ConnectorsClient } from "./connectors-client";

export default async function ConnectorsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  try {
    requireRole(session.user.role, [Role.SUPER_ADMIN]);
  } catch {
    redirect("/dashboard");
  }

  const connectors = await getConnectors();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ui-page-title">Connectors</h1>
        <p className="ui-page-subtitle">
          Στοιχεία διασύνδεσης της εφαρμογής με τρίτες εφαρμογές (eshop &amp; ERP). Οι
          διασυνδέσεις αυτές θα τροφοδοτούν λίστες που χρησιμοποιούνται στις διαδικασίες.
          Η αντιστοίχιση αντικειμένων (πελάτες, προμηθευτές, προϊόντα κ.λπ.) θα προστεθεί σε
          επόμενη φάση.
        </p>
      </div>
      <ConnectorsClient connectors={connectors} />
    </div>
  );
}

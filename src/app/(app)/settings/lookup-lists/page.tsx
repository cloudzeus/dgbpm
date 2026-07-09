import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { LookupListsClient } from "./lookup-lists-client";

export default async function LookupListsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  try {
    requireRole(session.user.role, [Role.SUPER_ADMIN]);
  } catch {
    redirect("/dashboard");
  }
  const lists = await prisma.lookupList.findMany({
    orderBy: { name: "asc" },
    include: { items: { orderBy: { order: "asc" } }, _count: { select: { fields: true } } },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Λίστες Τιμών</h1>
        <p className="text-muted-foreground">
          Διαχειριστείτε επαναχρησιμοποιήσιμες λίστες τιμών για πεδία τύπου combo-box στα πρότυπα διαδικασιών.
        </p>
      </div>
      <LookupListsClient lists={lists} />
    </div>
  );
}

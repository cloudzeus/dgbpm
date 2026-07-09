import type { Role } from "@prisma/client";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Υπερδιαχειριστής",
  ADMIN: "Διαχειριστής",
  MANAGER: "Προϊστάμενος",
  EMPLOYEE: "Υπάλληλος",
};

/** Greek label for a user role enum value. */
export function roleLabel(role: Role | string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

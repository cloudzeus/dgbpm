import type { Role } from "@prisma/client";

export function requireRole(userRole: Role | undefined, allowed: Role[]): void {
  if (!userRole || !allowed.includes(userRole)) {
    throw new Error("Forbidden");
  }
}

export type Permission =
  | "users.read"
  | "users.create"
  | "users.update"
  | "users.delete"
  | "departments.read"
  | "departments.create"
  | "departments.update"
  | "departments.delete"
  | "positions.read"
  | "positions.create"
  | "positions.update"
  | "positions.delete"
  | "processTemplates.read"
  | "processTemplates.create"
  | "processTemplates.update"
  | "processTemplates.delete"
  | "processInstances.create"
  | "processInstances.read"
  | "tasks.updateStatus";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "users.read",
    "users.create",
    "users.update",
    "users.delete",
    "departments.read",
    "departments.create",
    "departments.update",
    "departments.delete",
    "positions.read",
    "positions.create",
    "positions.update",
    "positions.delete",
    "processTemplates.read",
    "processTemplates.create",
    "processTemplates.update",
    "processTemplates.delete",
    "processInstances.create",
    "processInstances.read",
    "tasks.updateStatus",
  ],
  ADMIN: [
    "users.read",
    "users.create",
    "users.update",
    "users.delete",
    "departments.read",
    "departments.create",
    "departments.update",
    "departments.delete",
    "positions.read",
    "positions.create",
    "positions.update",
    "positions.delete",
    "processTemplates.read",
    "processTemplates.create",
    "processTemplates.update",
    "processTemplates.delete",
    "processInstances.create",
    "processInstances.read",
    "tasks.updateStatus",
  ],
  MANAGER: [
    "users.read",
    "processTemplates.read",
    "processInstances.read",
    "processInstances.create",
    "tasks.updateStatus",
  ],
  EMPLOYEE: ["processInstances.read", "processInstances.create", "tasks.updateStatus"],
};

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

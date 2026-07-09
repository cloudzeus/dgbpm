"use client";
import type { OrgUser } from "./org-avatar";

export type DeptData = {
  id: string; name: string; color: string; parentId: string | null;
  email: string | null; phoneNumber: string | null;
  positions: { id: string; name: string; managerId: string | null; users: { user: OrgUser }[] }[];
};

export function OrganizationClient({ departments }: { departments: DeptData[]; users: OrgUser[] }) {
  return <div className="rounded-lg border p-8 text-muted-foreground">{departments.length} τμήματα</div>;
}

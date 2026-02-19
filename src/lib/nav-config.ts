import type { Role } from "@prisma/client";
import {
  FiLayout,
  FiUsers,
  FiBriefcase,
  FiFolder,
  FiList,
  FiPlay,
  FiCheckSquare,
  FiFileText,
  FiBarChart2,
  FiUser,
  FiCheckCircle,
  FiLayers,
} from "react-icons/fi";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: FiLayout, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] },
  { href: "/users", label: "Users", icon: FiUsers, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/departments", label: "Departments", icon: FiFolder, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/positions", label: "Job Positions", icon: FiBriefcase, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/process-templates", label: "Process Templates", icon: FiFileText, roles: ["SUPER_ADMIN"] },
  { href: "/process-instances", label: "Process Instances", icon: FiList, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] },
  { href: "/my-tasks", label: "My Tasks", icon: FiCheckSquare, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] },
  { href: "/my-processes", label: "My Processes", icon: FiPlay, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] },
];

export const reportNavItems: NavItem[] = [
  { href: "/reports/by-user", label: "By User", icon: FiUser, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { href: "/reports/by-task", label: "By Task", icon: FiCheckCircle, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { href: "/reports/summary", label: "Process Summary", icon: FiLayers, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
];

export function getNavItemsForRole(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return navItems.filter((item) => item.roles.includes(role));
}

export function getReportNavItemsForRole(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return reportNavItems.filter((item) => item.roles.includes(role));
}

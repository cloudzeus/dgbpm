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
  FiPieChart,
  FiShare2,
  FiSliders,
  FiCpu,
  FiHome,
  FiLink,
  FiMail,
  FiDatabase,
  FiPackage,
} from "react-icons/fi";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Πίνακας Ελέγχου", icon: FiLayout, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] },
  { href: "/users", label: "Χρήστες", icon: FiUsers, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/departments", label: "Τμήματα", icon: FiFolder, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/organization", label: "Οργανόγραμμα", icon: FiShare2, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/positions", label: "Θέσεις Εργασίας", icon: FiBriefcase, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/entities", label: "Οντότητες", icon: FiPackage, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/process-templates", label: "Πρότυπα Διαδικασιών", icon: FiFileText, roles: ["SUPER_ADMIN"] },
  { href: "/process-instances", label: "Διαδικασίες", icon: FiList, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] },
  { href: "/my-tasks", label: "Οι Εργασίες μου", icon: FiCheckSquare, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] },
  { href: "/my-processes", label: "Οι Διαδικασίες μου", icon: FiPlay, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] },
];

export const reportNavItems: NavItem[] = [
  { href: "/reports/overview", label: "Επισκόπηση", icon: FiPieChart, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { href: "/reports/by-user", label: "Ανά Χρήστη", icon: FiUser, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { href: "/reports/by-task", label: "Ανά Εργασία", icon: FiCheckCircle, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { href: "/reports/summary", label: "Σύνοψη Διαδικασιών", icon: FiLayers, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { href: "/reports/mailgun", label: "Emails (Mailgun)", icon: FiMail, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
];

export const settingsNavItems: NavItem[] = [
  { href: "/settings/company", label: "Εταιρία", icon: FiHome, roles: ["SUPER_ADMIN"] },
  { href: "/settings/lookup-lists", label: "Λίστες Τιμών", icon: FiSliders, roles: ["SUPER_ADMIN"] },
  { href: "/settings/connectors", label: "Connectors", icon: FiLink, roles: ["SUPER_ADMIN"] },
  { href: "/settings/process-advisor", label: "AI Σύμβουλος", icon: FiCpu, roles: ["SUPER_ADMIN"] },
  { href: "/settings/data-migration", label: "Data Migration", icon: FiDatabase, roles: ["SUPER_ADMIN"] },
];

export function getNavItemsForRole(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return navItems.filter((item) => item.roles.includes(role));
}

export function getReportNavItemsForRole(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return reportNavItems.filter((item) => item.roles.includes(role));
}

export function getSettingsNavItemsForRole(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return settingsNavItems.filter((item) => item.roles.includes(role));
}

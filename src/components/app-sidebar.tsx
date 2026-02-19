"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { getNavItemsForRole } from "@/lib/nav-config";
import type { Role } from "@prisma/client";

export function AppSidebar({ role }: { role: Role | undefined }) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const items = getNavItemsForRole(role);
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border bg-[#0c0ce5]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="p-0">
              <Link href="/dashboard" className="flex items-center justify-center overflow-hidden">
                {isCollapsed ? (
                  <Image
                    src="/HappyOnLineIconLogo.svg"
                    alt="HappyOnLine"
                    width={40}
                    height={40}
                    className="size-10 object-contain shrink-0"
                  />
                ) : (
                  <Image
                    src="/HappyOnLineFullLogo.svg"
                    alt="HappyOnLine"
                    width={180}
                    height={44}
                    className="h-11 w-auto max-w-[180px] object-contain object-left"
                  />
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
                        <Icon className="size-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

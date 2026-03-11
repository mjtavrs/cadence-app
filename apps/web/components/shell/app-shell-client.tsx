"use client";

import { useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";

import { Sidebar } from "@/components/shell/sidebar";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { SidebarUserBlock } from "@/components/shell/sidebar-user-block";
import { Topbar } from "@/components/shell/topbar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { WorkspaceRoleProvider } from "@/hooks/use-workspace-role";

export type AppShellUser = {
  name: string | null;
  email: string | null;
  avatar: string | null;
} | null;

export function AppShellClient(props: {
  children: React.ReactNode;
  workspaceName: string | null;
  workspaceRole: string | null;
  workspaceLogoUrl: string | null;
  user: AppShellUser;
}) {
  const { resolvedTheme } = useTheme();
  const sidebar = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileLogoSrc = resolvedTheme === "dark" ? "/logo_light.webp" : "/logo_dark.webp";

  return (
    <WorkspaceRoleProvider role={props.workspaceRole}>
    <div className="min-h-screen bg-background">
      <div className="flex w-full min-w-0">
        <Sidebar
          collapsed={sidebar.collapsed}
          user={props.user}
          workspaceRole={props.workspaceRole}
        />

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex flex-col p-0 md:hidden">
            <SheetHeader>
              <SheetTitle className="sr-only">Cadence</SheetTitle>
              <div className="flex items-center justify-center">
                <Image
                  src={mobileLogoSrc}
                  alt="Cadence"
                  width={150}
                  height={150}
                  className="h-auto w-28 object-contain"
                  priority
                />
              </div>
            </SheetHeader>
            <div className="flex-1 overflow-auto px-4 pb-4">
              <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="px-4 py-3">
              <SidebarUserBlock
                user={props.user}
                workspaceRole={props.workspaceRole}
                collapsed={false}
                onOpenProfile={() => setMobileOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <Topbar
            workspaceName={props.workspaceName}
            workspaceLogoUrl={props.workspaceLogoUrl}
            canManageWorkspace={props.workspaceRole === "OWNER" || props.workspaceRole === "ADMIN"}
            onToggleDesktopSidebar={sidebar.toggle}
            onOpenMobileSidebar={() => setMobileOpen(true)}
          />
          <main className="min-w-0 p-3 sm:p-4 md:p-6">{props.children}</main>
        </div>
      </div>
    </div>
    </WorkspaceRoleProvider>
  );
}

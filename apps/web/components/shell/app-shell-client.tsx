"use client";

import { useState } from "react";

import { Sidebar } from "@/components/shell/sidebar";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { SidebarUserBlock } from "@/components/shell/sidebar-user-block";
import { Topbar } from "@/components/shell/topbar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

export type AppShellUser = {
  name: string | null;
  email: string | null;
  avatar: string | null;
} | null;

export function AppShellClient(props: {
  children: React.ReactNode;
  workspaceName: string | null;
  workspaceRole: string | null;
  user: AppShellUser;
}) {
  const sidebar = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex w-full">
        <Sidebar
          collapsed={sidebar.collapsed}
          user={props.user}
          workspaceRole={props.workspaceRole}
        />

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex flex-col p-0 md:hidden">
            <SheetHeader>
              <SheetTitle>Cadence</SheetTitle>
              {props.workspaceName ? (
                <div className="text-muted-foreground text-xs">{props.workspaceName}</div>
              ) : null}
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
            onToggleDesktopSidebar={sidebar.toggle}
            onOpenMobileSidebar={() => setMobileOpen(true)}
          />
          <main className="min-w-0 p-4 md:p-6">{props.children}</main>
        </div>
      </div>
    </div>
  );
}


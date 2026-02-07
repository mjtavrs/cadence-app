"use client";

import { useState } from "react";

import { Sidebar } from "@/components/shell/sidebar";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { Topbar } from "@/components/shell/topbar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

export function AppShellClient(props: { children: React.ReactNode; workspaceName: string | null }) {
  const sidebar = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex w-full">
        <Sidebar collapsed={sidebar.collapsed} />

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 md:hidden">
            <SheetHeader>
              <SheetTitle>Cadence</SheetTitle>
              {props.workspaceName ? (
                <div className="text-muted-foreground text-xs">{props.workspaceName}</div>
              ) : null}
            </SheetHeader>
            <div className="px-4 pb-4">
              <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main */}
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


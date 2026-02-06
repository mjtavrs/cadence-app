"use client";

import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

export default function AppLayout(props: { children: React.ReactNode }) {
  const sidebar = useSidebarCollapsed();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar desktop */}
        <Sidebar collapsed={sidebar.collapsed} />

        {/* Main */}
        <div className="min-w-0 flex-1">
          <Topbar onToggleSidebar={sidebar.toggle} />
          <main className="min-w-0">{props.children}</main>
        </div>
      </div>
    </div>
  );
}


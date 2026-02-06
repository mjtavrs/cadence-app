"use client";

import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";

export function Sidebar(props: { collapsed: boolean }) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r bg-background md:flex",
        props.collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div className="flex w-full flex-col gap-4 p-4">
        <div className={cn("flex items-center gap-2", props.collapsed && "justify-center")}>
          <div className="h-8 w-8 rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900" />
          {!props.collapsed && <div className="text-sm font-semibold">Cadence</div>}
        </div>

        <SidebarNav collapsed={props.collapsed} />
      </div>
    </aside>
  );
}


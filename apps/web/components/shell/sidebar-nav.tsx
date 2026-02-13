"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";

export function SidebarNav(props: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active =
          item.href === "/app"
            ? pathname === "/app" || pathname === "/app/"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => props.onNavigate?.()}
            className={cn(
              "flex items-center rounded-lg border-2 text-sm transition-colors",
              "border-transparent text-muted-foreground",
              "hover:bg-zinc-900/5 hover:text-foreground dark:hover:bg-white/10",
              active && "border-border bg-zinc-900/5 text-foreground font-medium dark:bg-white/10",
              props.collapsed ? "h-9 w-9 justify-center box-border" : "gap-3 px-3 py-2",
            )}
          >
            <Icon className={cn("shrink-0", props.collapsed ? "h-5 w-5" : "h-4 w-4")} />
            {!props.collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}


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
              "flex items-center gap-3 rounded-lg border-2 px-3 py-2 text-sm transition-colors",
              "border-transparent text-muted-foreground",
              "hover:bg-zinc-900/5 hover:text-foreground dark:hover:bg-white/10",
              active && "border-border bg-zinc-900/5 text-foreground font-medium dark:bg-white/10",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!props.collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}


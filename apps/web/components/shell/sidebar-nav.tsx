"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";

export function SidebarNav(props: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              "hover:bg-zinc-900/5 dark:hover:bg-white/10",
              active && "bg-zinc-900/5 dark:bg-white/10",
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


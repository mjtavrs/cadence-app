"use client";

import Image from "next/image";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";
import { SidebarUserBlock } from "./sidebar-user-block";
import type { AppShellUser } from "./app-shell-client";

export function Sidebar(props: {
  collapsed: boolean;
  user: AppShellUser;
  workspaceRole: string | null;
}) {
  const { resolvedTheme } = useTheme();
  const smallLogoSrc = "/logo_small.webp";
  const largeLogoSrc = resolvedTheme === "dark" ? "/logo_light.webp" : "/logo_dark.webp";

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-background md:flex",
        "transition-all duration-300 ease-in-out",
        props.collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div
        className={cn(
          "flex w-full flex-1 flex-col gap-4",
          props.collapsed ? "items-center p-3" : "p-4",
        )}
      >
        <div className={cn("relative w-full", props.collapsed ? "h-10" : "")}>
          <div
            className={cn(
              "transition-opacity duration-200 ease-in-out",
              props.collapsed
                ? "relative flex h-10 w-full items-center justify-center opacity-100"
                : "pointer-events-none absolute inset-0 flex items-center justify-center opacity-0",
            )}
          >
            <Image
              src={smallLogoSrc}
              alt="Cadence"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              priority
            />
          </div>

          <div
            className={cn(
              "transition-opacity duration-200 ease-in-out",
              props.collapsed ? "pointer-events-none absolute inset-0 opacity-0" : "relative opacity-100",
            )}
          >
            <Image
              src={largeLogoSrc}
              alt="Cadence"
              width={260}
              height={260}
              className="w-full rounded-lg object-contain"
              priority
            />
          </div>
        </div>

        <SidebarNav collapsed={props.collapsed} />
      </div>

      <div
        className={cn(
          "p-3",
          props.collapsed ? "flex justify-center" : "px-4",
        )}
      >
        <SidebarUserBlock
          user={props.user}
          workspaceRole={props.workspaceRole}
          collapsed={props.collapsed}
        />
      </div>
    </aside>
  );
}


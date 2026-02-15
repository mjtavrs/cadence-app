"use client";

import Link from "next/link";
import { PanelLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

export function Topbar(props: {
  workspaceName: string | null;
  onOpenMobileSidebar(): void;
  onToggleDesktopSidebar(): void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <Button
          className="md:hidden"
          variant="ghost"
          size="icon"
          onClick={props.onOpenMobileSidebar}
          aria-label="Abrir menu"
        >
          <PanelLeftIcon className="h-4 w-4" />
        </Button>
        <Button
          className="hidden md:inline-flex"
          variant="ghost"
          size="icon"
          onClick={props.onToggleDesktopSidebar}
          aria-label="Alternar sidebar"
        >
          <PanelLeftIcon className="h-4 w-4" />
        </Button>

        <div className="flex flex-col leading-tight">
          <div className="text-sm font-medium">Cadence</div>
          {props.workspaceName ? (
            <div className="text-muted-foreground text-xs">{props.workspaceName}</div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" asChild>
          <Link href="/w">Ver meus workspaces</Link>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}


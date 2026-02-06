"use client";

import Link from "next/link";
import { PanelLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

export function Topbar(props: { onToggleSidebar(): void }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={props.onToggleSidebar} aria-label="Alternar sidebar">
          <PanelLeftIcon className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium">Cadence</div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" asChild>
          <Link href="/w">Workspace</Link>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}


"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PanelLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { WorkspaceSelectorContent } from "@/components/shell/workspace-selector-content";
import { ThemeToggle } from "./theme-toggle";

export function Topbar(props: {
  workspaceName: string | null;
  onOpenMobileSidebar(): void;
  onToggleDesktopSidebar(): void;
}) {
  const router = useRouter();
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const { data, error, loading, selecting, select, refetch } = useWorkspaces();

  const handleOpenChange = (open: boolean) => {
    setWorkspaceDialogOpen(open);
    if (open) refetch();
  };

  const handleSelect = (workspaceId: string) => {
    select(workspaceId).then((ok) => {
      if (ok) {
        setWorkspaceDialogOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setWorkspaceDialogOpen(true)}
          >
            Ver meus workspaces
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <Dialog open={workspaceDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecione um workspace</DialogTitle>
            <DialogDescription>
              Escolha a empresa em que você vai trabalhar agora.
            </DialogDescription>
          </DialogHeader>
          <WorkspaceSelectorContent
            data={data}
            error={error}
            loading={loading}
            selecting={selecting}
            onSelect={handleSelect}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}


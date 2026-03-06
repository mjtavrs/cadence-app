"use client";

import { useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOutIcon, UserCircleIcon, UserIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/lib/file-utils";
import { cn } from "@/lib/utils";
import type { AppShellUser } from "./app-shell-client";
import { ProfileModal } from "./profile-modal";

type StorageSummary = {
  itemsUsed: number;
  itemsLimit: number;
  bytesUsed: number;
  bytesLimit: number;
};

async function loadStorageSummary(): Promise<StorageSummary> {
  const res = await fetch("/api/media/summary", { cache: "no-store" });
  const payload = (await res.json().catch(() => null)) as Partial<StorageSummary> | null;
  if (!res.ok) throw new Error("Falha ao carregar armazenamento.");
  return {
    itemsUsed: payload?.itemsUsed ?? 0,
    itemsLimit: payload?.itemsLimit ?? 30,
    bytesUsed: payload?.bytesUsed ?? 0,
    bytesLimit: payload?.bytesLimit ?? 30 * 10 * 1024 * 1024,
  };
}

function UserChip(props: { user: AppShellUser; workspaceRole: string | null; collapsed: boolean }) {
  const displayName = props.user?.name ?? props.user?.email ?? "Usuario";

  return (
    <>
      {props.user?.avatar ? (
        <img src={props.user.avatar} alt="" className="size-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <UserIcon className="size-4 text-muted-foreground" />
        </span>
      )}
      {!props.collapsed ? (
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{displayName}</div>
          {props.workspaceRole ? (
            <div className="text-muted-foreground truncate text-xs">{props.workspaceRole}</div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function SidebarUserBlock(props: {
  user: AppShellUser;
  workspaceRole: string | null;
  collapsed: boolean;
  onOpenProfile?: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const storageQuery = useQuery({
    queryKey: ["media-storage-summary"],
    queryFn: loadStorageSummary,
    enabled: !props.collapsed,
    staleTime: 30_000,
  });

  const storageSummary = storageQuery.data;
  const storagePercent =
    storageSummary && storageSummary.bytesLimit > 0
      ? Math.min(100, Math.round((storageSummary.bytesUsed / storageSummary.bytesLimit) * 100))
      : 0;

  async function handleLogout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      window.location.href = "/login";
    }
  }

  function openProfile() {
    setProfileOpen(true);
    props.onOpenProfile?.();
  }

  return (
    <>
      {!props.collapsed ? (
        <div className="mb-3 rounded-xl border border-border/70 bg-muted/25 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Armazenamento
              </p>
              {storageQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando resumo...</p>
              ) : storageQuery.isError ? (
                <p className="text-sm text-muted-foreground">Resumo indisponivel.</p>
              ) : storageSummary ? (
                <p className="text-sm font-medium">
                  {formatFileSize(storageSummary.bytesUsed)} de {formatFileSize(storageSummary.bytesLimit)}
                </p>
              ) : null}
            </div>
          </div>

          <Progress value={storagePercent} className="mt-3 h-2.5" />
        </div>
      ) : null}

      {mounted ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border p-2 text-left outline-none transition-colors hover:bg-zinc-900/5 dark:hover:bg-white/10",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              props.collapsed && "justify-center p-2",
            )}
          >
            <UserChip user={props.user} workspaceRole={props.workspaceRole} collapsed={props.collapsed} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuItem onClick={openProfile}>
              <UserCircleIcon className="size-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOutIcon className="size-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border border-border p-2",
            props.collapsed && "justify-center p-2",
          )}
        >
          <UserChip user={props.user} workspaceRole={props.workspaceRole} collapsed={props.collapsed} />
        </div>
      )}

      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

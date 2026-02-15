"use client";

import { useState } from "react";
import { LogOutIcon, UserIcon, UserCircleIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ProfileModal } from "./profile-modal";
import type { AppShellUser } from "./app-shell-client";

export function SidebarUserBlock(props: {
  user: AppShellUser;
  workspaceRole: string | null;
  collapsed: boolean;
  onOpenProfile?: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const displayName = props.user?.name ?? props.user?.email ?? "Usuário";

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
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border p-2 text-left outline-none transition-colors hover:bg-zinc-900/5 dark:hover:bg-white/10",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            props.collapsed && "justify-center p-2",
          )}
        >
          {props.user?.avatar ? (
            <img
              src={props.user.avatar}
              alt=""
              className="size-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <UserIcon className="size-4 text-muted-foreground" />
            </span>
          )}
          {!props.collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{displayName}</div>
              {props.workspaceRole ? (
                <div className="text-muted-foreground truncate text-xs">{props.workspaceRole}</div>
              ) : null}
            </div>
          )}
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
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

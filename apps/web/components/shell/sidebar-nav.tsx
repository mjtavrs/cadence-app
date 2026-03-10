"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FaChevronRight, FaFolder } from "react-icons/fa";

import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";
import type { MediaFolder } from "@/hooks/use-media-library";

type FolderNode = MediaFolder & { children: FolderNode[] };

async function loadFolders() {
  const res = await fetch("/api/media/folders", { cache: "no-store" });
  const payload = (await res.json().catch(() => null)) as { items?: MediaFolder[]; message?: string } | null;
  if (!res.ok) throw new Error(payload?.message ?? "Falha ao carregar pastas.");
  return payload?.items ?? [];
}

function buildFolderTree(folders: MediaFolder[], parentId: string | null): FolderNode[] {
  return folders
    .filter((folder) => (folder.parentFolderId ?? null) === parentId)
    .map((folder) => ({
      ...folder,
      children: buildFolderTree(folders, folder.id),
    }));
}

function collectAncestorIds(byId: Map<string, MediaFolder>, folderId: string): string[] {
  const ancestorIds: string[] = [];
  let cursor = byId.get(folderId) ?? null;
  const guard = new Set<string>();

  while (cursor && cursor.parentFolderId && !guard.has(cursor.parentFolderId)) {
    ancestorIds.push(cursor.parentFolderId);
    guard.add(cursor.parentFolderId);
    cursor = byId.get(cursor.parentFolderId) ?? null;
  }

  return ancestorIds;
}

export function SidebarNav(props: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mediaFolderId = pathname.startsWith("/app/media") ? searchParams.get("folderId") : null;

  const foldersQuery = useQuery({
    queryKey: ["media-folders"],
    queryFn: loadFolders,
    staleTime: 30_000,
    enabled: !props.collapsed,
  });

  const folders = foldersQuery.data ?? [];
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder] as const)), [folders]);
  const rootNodes = useMemo(() => buildFolderTree(folders, null), [folders]);

  const [mediaExpanded, setMediaExpanded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!mediaFolderId || !folderById.has(mediaFolderId)) return;
    const ancestors = collectAncestorIds(folderById, mediaFolderId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      ancestors.forEach((id) => next.add(id));
      return next;
    });
  }, [mediaFolderId, folderById]);

  const mediaItem = navItems.find((item) => item.href === "/app/media");
  const mediaIndex = navItems.findIndex((item) => item.href === "/app/media");
  const itemsBeforeMedia = (mediaIndex >= 0 ? navItems.slice(0, mediaIndex) : navItems).filter(
    (item) => item.href !== "/app/media",
  );
  const itemsAfterMedia = mediaIndex >= 0 ? navItems.slice(mediaIndex + 1) : [];
  const isMediaRoute = pathname === "/app/media" || pathname.startsWith("/app/media/");
  const mediaRootActive = isMediaRoute && !mediaFolderId;

  function renderNavItem(item: (typeof navItems)[number]) {
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
  }

  function toggleFolderExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderFolderNode(node: FolderNode, depth = 0): React.ReactNode {
    const hasChildren = node.children.length > 0;
    const expanded = expandedIds.has(node.id);
    const active = mediaFolderId === node.id;
    const leftIndent = 12 + depth * 14;

    return (
      <div key={node.id} className="space-y-1">
        <div style={{ paddingLeft: `${leftIndent}px` }}>
          <div
            className={cn(
              "flex items-center rounded-lg border-2 border-transparent text-sm text-muted-foreground transition-colors",
              "hover:bg-zinc-900/5 hover:text-foreground dark:hover:bg-white/10",
              active && "border-border bg-zinc-900/5 text-foreground font-medium dark:bg-white/10",
            )}
          >
            <Link
              href={`/app/media?folderId=${encodeURIComponent(node.id)}`}
              onClick={() => props.onNavigate?.()}
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2"
              title={node.name}
            >
              <FaFolder className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{node.name}</span>
            </Link>
            <button
              type="button"
              className={cn(
                "mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
                hasChildren
                  ? "hover:bg-zinc-900/10 hover:text-foreground dark:hover:bg-white/10"
                  : "opacity-45 hover:bg-zinc-900/10 dark:hover:bg-white/10",
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFolderExpand(node.id);
              }}
              aria-label={expanded ? "Recolher subpastas" : "Expandir subpastas"}
              aria-expanded={expanded}
            >
              <FaChevronRight
                className={cn(
                  "h-2.5 w-2.5 transform-gpu transition-transform duration-200 ease-out",
                )}
                style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
              />
            </button>
          </div>
        </div>
        {hasChildren && expanded ? <div className="space-y-1">{node.children.map((child) => renderFolderNode(child, depth + 1))}</div> : null}
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      {itemsBeforeMedia.map((item) => renderNavItem(item))}

      {mediaItem ? (
        props.collapsed ? (
          <Link
            href="/app/media"
            onClick={() => props.onNavigate?.()}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border-2 box-border text-sm transition-colors",
              "border-transparent text-muted-foreground hover:bg-zinc-900/5 hover:text-foreground dark:hover:bg-white/10",
              mediaRootActive && "border-border bg-zinc-900/5 text-foreground font-medium dark:bg-white/10",
            )}
            title={mediaItem.label}
          >
            <mediaItem.icon className="h-5 w-5 shrink-0" />
          </Link>
        ) : (
          <div className="space-y-1">
            <div
              className={cn(
                "flex items-center rounded-lg border-2 text-sm transition-colors",
                "border-transparent text-muted-foreground hover:bg-zinc-900/5 hover:text-foreground dark:hover:bg-white/10",
                mediaRootActive && "border-border bg-zinc-900/5 text-foreground font-medium dark:bg-white/10",
              )}
            >
              <Link
                href="/app/media"
                onClick={() => props.onNavigate?.()}
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2"
              >
                <mediaItem.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{mediaItem.label}</span>
              </Link>
              <button
                type="button"
                className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-zinc-900/10 hover:text-foreground dark:hover:bg-white/10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMediaExpanded((prev) => !prev);
                }}
                aria-label={mediaExpanded ? "Recolher pastas" : "Expandir pastas"}
                aria-expanded={mediaExpanded}
              >
                <FaChevronRight
                  className={cn(
                    "h-2.5 w-2.5 transform-gpu transition-transform duration-200 ease-out",
                  )}
                  style={{ transform: mediaExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                />
              </button>
            </div>

            {mediaExpanded ? (
              foldersQuery.isLoading ? (
                <div className="px-3 py-1 text-xs text-muted-foreground">Carregando pastas...</div>
              ) : rootNodes.length > 0 ? (
                <div className="space-y-1 py-0.5">{rootNodes.map((node) => renderFolderNode(node, 0))}</div>
              ) : (
                <div className="px-3 py-1 text-xs text-muted-foreground">Sem pastas</div>
              )
            ) : null}
          </div>
        )
      ) : null}

      {itemsAfterMedia.map((item) => renderNavItem(item))}
    </nav>
  );
}

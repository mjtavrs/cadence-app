"use client";

import { useEffect, useId, useRef, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useMediaLibrary,
  type MediaItem,
  type MediaFolder,
} from "@/hooks/use-media-library";
import { UploadProgressPanel } from "@/components/media/upload-progress-panel";
import { SelectionOverlay } from "@/components/media/selection-overlay";
import { MediaDetailsSheet } from "@/components/media/media-details-sheet";
import { useMediaSelection } from "@/hooks/use-media-selection";
import { ImageIcon, TrashIcon, HelpCircle, Eye, Pencil, Info, Loader2, ChevronDown } from "lucide-react";
import { FaChevronRight, FaImage, FaVideo } from "react-icons/fa";
import { FiFolder, FiFolderPlus } from "react-icons/fi";
import { LuImagePlus, LuPencilLine } from "react-icons/lu";
import { SlOptionsVertical } from "react-icons/sl";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const HELP_MESSAGE =
  "Se a imagem não aparecer, seu navegador pode não suportar esse formato (ex.: HEIC em alguns navegadores).";

export function MediaUploadAction(props: { initialItems?: MediaItem[] }) {
  const media = useMediaLibrary({ initialItems: props.initialItems });
  const inputId = useId();

  return (
    <div className="flex items-center gap-2">
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length === 0) return;
          e.target.value = "";
          if (files.length === 1) {
            void media.onPickFile(files[0]);
          } else if (media.onPickFiles) {
            void media.onPickFiles(files);
          } else {
            files.forEach((file) => void media.onPickFile(file));
          }
        }}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-10 shrink-0" aria-label="Ajuda">
            <HelpCircle className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-balance">
          {HELP_MESSAGE}
        </TooltipContent>
      </Tooltip>
      <Button
        disabled={media.isBusy || !media.canUpload}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        {media.uploadPending ? (
          <span className="flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            Enviando...
          </span>
        ) : (
          "Enviar imagens"
        )}
      </Button>
    </div>
  );
}

const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/heic,image/heif";

const IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const VIDEO_CONTENT_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function isImageType(contentType: string) {
  return IMAGE_CONTENT_TYPES.has(contentType);
}
function isVideoType(contentType: string) {
  return VIDEO_CONTENT_TYPES.has(contentType);
}

const DRAG_THRESHOLD_PX = 5;
const INTERNAL_MEDIA_DRAG_TYPE = "application/x-cadence-media-ids";
type MediaTypeFilter = "all" | "image" | "video";
type UploadDateFilter = "all" | "today" | "yesterday" | "last7days" | "lastMonth";
const BREADCRUMB_ROOT_DROP_KEY = "__root__";
type FolderUploadFile = { file: File; relativePath: string };
type FolderUploadSummary = {
  entries: FolderUploadFile[];
  roots: Array<{ name: string; count: number; willMerge: boolean }>;
  targetLabel: string;
};

type BreadcrumbNode = {
  id: string | null;
  name: string;
};

function matchesMediaType(item: MediaItem, filter: MediaTypeFilter) {
  if (filter === "all") return true;
  if (filter === "image") return isImageType(item.contentType);
  if (filter === "video") return isVideoType(item.contentType);
  return true;
}

function matchesUploadDate(item: MediaItem, filter: UploadDateFilter) {
  if (filter === "all") return true;

  const createdAt = new Date(item.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const last7Start = new Date(todayStart);
  last7Start.setDate(last7Start.getDate() - 6);
  const lastMonthStart = new Date(todayStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

  if (filter === "today") return createdAt >= todayStart;
  if (filter === "yesterday") return createdAt >= yesterdayStart && createdAt < todayStart;
  if (filter === "last7days") return createdAt >= last7Start;
  if (filter === "lastMonth") return createdAt >= lastMonthStart;

  return true;
}

function buildBreadcrumbPath(folders: MediaFolder[], currentFolderId: string | null): BreadcrumbNode[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder] as const));
  const nodes: BreadcrumbNode[] = [{ id: null, name: "Biblioteca de mídia" }];
  if (!currentFolderId) return nodes;

  const chain: MediaFolder[] = [];
  let cursor = byId.get(currentFolderId) ?? null;
  const guard = new Set<string>();

  while (cursor && !guard.has(cursor.id)) {
    chain.push(cursor);
    guard.add(cursor.id);
    cursor = cursor.parentFolderId ? (byId.get(cursor.parentFolderId) ?? null) : null;
  }

  chain.reverse().forEach((folder) => {
    nodes.push({ id: folder.id, name: folder.name });
  });

  return nodes;
}

type NativeFileWithRelativePath = File & { webkitRelativePath?: string };

function sanitizeRelativePath(input: string) {
  return input
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

function getFolderPathFromRelativePath(relativePath: string) {
  const cleaned = sanitizeRelativePath(relativePath);
  const parts = cleaned.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

function normalizeComparableName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
};

type FileSystemFileEntryLike = FileSystemEntryLike & {
  file: (success: (file: File) => void, error?: (err: unknown) => void) => void;
};

type FileSystemDirectoryReaderLike = {
  readEntries: (success: (entries: FileSystemEntryLike[]) => void, error?: (err: unknown) => void) => void;
};

type FileSystemDirectoryEntryLike = FileSystemEntryLike & {
  createReader: () => FileSystemDirectoryReaderLike;
};

async function readAllDirectoryEntries(reader: FileSystemDirectoryReaderLike): Promise<FileSystemEntryLike[]> {
  const all: FileSystemEntryLike[] = [];
  while (true) {
    const entries = await new Promise<FileSystemEntryLike[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (entries.length === 0) return all;
    all.push(...entries);
  }
}

async function walkDroppedEntry(entry: FileSystemEntryLike, prefix: string): Promise<FolderUploadFile[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntryLike;
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });
    const relativePath = sanitizeRelativePath(prefix ? `${prefix}/${file.name}` : file.name);
    return [{ file, relativePath }];
  }
  if (!entry.isDirectory) return [];

  const dirEntry = entry as FileSystemDirectoryEntryLike;
  const nextPrefix = sanitizeRelativePath(prefix ? `${prefix}/${dirEntry.name}` : dirEntry.name);
  const children = await readAllDirectoryEntries(dirEntry.createReader());
  const nested = await Promise.all(children.map((child) => walkDroppedEntry(child, nextPrefix)));
  return nested.flat();
}

function MediaGrid(props: {
  items: MediaItem[];
  deletingIds: Set<string>;
  uploadPending?: boolean;
  selectedIds: Set<string>;
  draggedIds: Set<string>;
  movingIds: Set<string>;
  didDragRef?: React.MutableRefObject<boolean>;
  onItemClick(item: MediaItem, e: React.MouseEvent, mode: "normal" | "add" | "range"): void;
  onRequestView(item: MediaItem): void;
  onRequestRename(item: MediaItem): void;
  onRequestDelete(id: string, fileName: string | null): void;
  onRequestDetails(item: MediaItem): void;
  onDragStart(item: MediaItem, event: React.DragEvent<HTMLButtonElement>): void;
  onDragEnd(): void;
  cardRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
      {props.items.map((m) => {
        const isDeleting = props.deletingIds.has(m.id);
        const isSelected = props.selectedIds.has(m.id);
        const isBeingDragged = props.draggedIds.has(m.id);
        const isBeingMoved = props.movingIds.has(m.id);
        return (
          <ContextMenu
            key={m.id}
            onOpenChange={(open) => {
              if (open && !isSelected) {
                props.onItemClick(m, { stopPropagation: () => {} } as React.MouseEvent, "normal");
              }
            }}
          >
            <ContextMenuTrigger asChild>
              <Card
                data-media-card="true"
                ref={(el) => {
                  if (el && props.cardRefs) props.cardRefs.current.set(m.id, el);
                  else if (props.cardRefs) props.cardRefs.current.delete(m.id);
                }}
                className={cn(
                  "overflow-hidden gap-0 p-0 transition-all select-none cursor-pointer",
                  isSelected && "ring-2 ring-primary ring-offset-2",
                  isBeingDragged && "opacity-60 border-dashed",
                  isBeingMoved && "opacity-60 border-dashed",
                )}
              >
                <button
                  type="button"
                  data-media-item="true"
                  className={cn(
                    "relative block w-full aspect-4/3 bg-zinc-100 dark:bg-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 select-none",
                    isBeingDragged && "cursor-grabbing",
                    isBeingMoved && "cursor-wait",
                  )}
                  draggable={!isDeleting}
                  onDragStart={(e) => props.onDragStart(m, e)}
                  onDragEnd={props.onDragEnd}
                  onDoubleClick={() => props.onRequestView(m)}
                  onClick={(e) => {
                    if (props.didDragRef?.current) {
                      props.didDragRef.current = false;
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    const mode = e.ctrlKey || e.metaKey ? "add" : e.shiftKey ? "range" : "normal";
                    props.onItemClick(m, e, mode);
                  }}
                >
              <img
                src={m.url}
                alt={m.fileName ?? "Mídia"}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.style.display = "none";
                }}
              />
              {isDeleting && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Spinner className="size-8 text-primary" />
                </div>
              )}
              {isBeingMoved && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Spinner className="size-8 text-primary" />
                </div>
              )}
            </button>
            <div
              className="flex items-center justify-between gap-2 p-2"
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (
                  target.closest("[data-slot='dropdown-menu-trigger']") ||
                  target.closest("[role='menu']") ||
                  target.closest("button")
                ) {
                  return;
                }
                const mode = e.ctrlKey || e.metaKey ? "add" : e.shiftKey ? "range" : "normal";
                props.onItemClick(m, e, mode);
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {isImageType(m.contentType) ? (
                  <FaImage className="size-4 shrink-0 text-muted-foreground" />
                ) : isVideoType(m.contentType) ? (
                  <FaVideo className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FaImage className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate text-sm font-medium select-none">{m.fileName ?? m.id}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={isDeleting}
                    aria-label="Opções"
                  >
                    <SlOptionsVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => props.onRequestView(m)}>
                    <Eye className="size-4" />
                    Visualizar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => props.onRequestDetails(m)}>
                    <Info className="size-4" />
                    Ver detalhes
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => props.onRequestRename(m)}>
                    <Pencil className="size-4" />
                    Renomear
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => props.onRequestDelete(m.id, m.fileName)}
                  >
                    <TrashIcon className="size-4" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuGroup>
                <ContextMenuItem onClick={() => props.onRequestView(m)}>
                  <Eye className="mr-2 size-4" />
                  Visualizar
                </ContextMenuItem>
                <ContextMenuItem onClick={() => props.onRequestDetails(m)}>
                  <Info className="mr-2 size-4" />
                  Ver detalhes
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => props.onRequestRename(m)}>
                  <Pencil className="mr-2 size-4" />
                  Renomear
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  variant="destructive"
                  onClick={() => props.onRequestDelete(m.id, m.fileName)}
                >
                  <TrashIcon className="mr-2 size-4" />
                  Excluir
                  <ContextMenuShortcut className="text-[10px]">Delete</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuGroup>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
      {props.uploadPending && (
        <Card key="uploading-placeholder" className="overflow-hidden gap-0 p-0 animate-in fade-in-0" aria-busy>
          <div className="relative flex w-full aspect-4/3 flex-col items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-900">
            <Spinner className="size-8 text-primary animate-spin" />
            <span className="text-muted-foreground text-xs font-medium">Enviando...</span>
          </div>
          <div className="flex items-center justify-between gap-2 p-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <FaImage className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground text-sm font-medium">Enviando...</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function FolderGrid(props: {
  folders: MediaFolder[];
  selectedFolderId: string | null;
  dropTargetFolderId: string | null;
  isMediaDragActive: boolean;
  creatingFolderId: string | null;
  deletingFolderIds: Set<string>;
  onSelectFolder: (id: string) => void;
  onOpenFolder: (id: string) => void;
  onRequestRenameFolder: (folder: MediaFolder) => void;
  onRequestDeleteFolder: (folder: MediaFolder) => void;
  onDragEnterFolder: (id: string) => void;
  onDragLeaveFolder: (id: string) => void;
  onDropToFolder: (id: string) => void;
}) {
  if (props.folders.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 p-1.5">
        {props.folders.map((folder) => {
          const isSelected = props.selectedFolderId === folder.id;
          const isDropTarget = props.dropTargetFolderId === folder.id;
          const isCreating = props.creatingFolderId === folder.id;
          const isDeleting = props.deletingFolderIds.has(folder.id);
          const isBusy = isCreating || isDeleting;
          return (
            <ContextMenu
              key={folder.id}
              onOpenChange={(open) => {
                if (open && !isSelected && !isBusy) props.onSelectFolder(folder.id);
              }}
            >
              <ContextMenuTrigger asChild>
                <div
                  data-folder-item="true"
                  className={cn(
                    "relative inline-flex w-fit max-w-[360px]",
                    props.isMediaDragActive && "cursor-move",
                    isBusy && "pointer-events-none",
                  )}
                  onDragEnter={(e) => {
                    if (!props.isMediaDragActive) return;
                    e.preventDefault();
                    e.stopPropagation();
                    props.onDragEnterFolder(folder.id);
                  }}
                  onDragOver={(e) => {
                    if (!props.isMediaDragActive) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = "move";
                    props.onDragEnterFolder(folder.id);
                  }}
                  onDragLeave={(e) => {
                    if (!props.isMediaDragActive) return;
                    const hovered = document.elementFromPoint(e.clientX, e.clientY);
                    if (hovered && e.currentTarget.contains(hovered)) return;
                    props.onDragLeaveFolder(folder.id);
                  }}
                  onDrop={(e) => {
                    if (!props.isMediaDragActive) return;
                    e.preventDefault();
                    e.stopPropagation();
                    props.onDropToFolder(folder.id);
                  }}
                >
                  <button
                    type="button"
                    className={cn(
                      "border-border inline-flex h-auto w-full max-w-[360px] appearance-none items-center shadow-xs gap-2.5 border text-left rounded-sm px-3 py-2 text-[15px] leading-5 bg-card shadow-black/10 transition-colors hover:bg-accent/50 cursor-pointer",
                      isSelected && "border-primary ring-2 ring-primary/30",
                      isDropTarget && "border-primary bg-primary/10 ring-2 ring-primary/25",
                      isBusy && "opacity-60",
                    )}
                    onClick={() => {
                      if (isBusy) return;
                      props.onSelectFolder(folder.id);
                    }}
                    onDoubleClick={() => {
                      if (isBusy) return;
                      props.onOpenFolder(folder.id);
                    }}
                  >
                    {isCreating ? (
                      <Loader2 className="size-[18px] shrink-0 animate-spin text-primary" />
                    ) : (
                      <FiFolder className="size-[18px] shrink-0 text-amber-500" />
                    )}
                    <span className="truncate text-[15px] font-medium leading-5">{folder.name}</span>
                  </button>
                  {isDeleting ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-background/70">
                      <Spinner className="size-5 text-primary" />
                    </div>
                  ) : null}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => props.onOpenFolder(folder.id)}>
                  <FiFolder className="mr-2 size-4" />
                  Abrir pasta
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => props.onRequestRenameFolder(folder)}>
                  <LuPencilLine className="mr-2 size-4" />
                  Renomear pasta
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  variant="destructive"
                  onClick={() => props.onRequestDeleteFolder(folder)}
                >
                  <TrashIcon className="mr-2 size-4" />
                  Excluir pasta
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
    </div>
  );
}

function Lightbox(props: {
  item: MediaItem | null;
  onClose: () => void;
}) {
  const { item, onClose } = props;

  useEffect(() => {
    if (!item) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-in fade-in-0"
      role="dialog"
      aria-modal
      aria-label="Visualizar mídia"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 z-0"
        aria-label="Fechar"
      />
      <div className="relative z-10 flex max-h-[90vh] max-w-[90vw] items-center justify-center p-4">
        <img
          src={item.url}
          alt={item.fileName ?? "Mídia"}
          className="max-h-[90vh] w-auto max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function DropZone(props: {
  children: React.ReactNode;
  onFile: (file: File) => void;
  onFiles?: (files: File[]) => void;
  onFolderFiles?: (entries: FolderUploadFile[]) => void;
  disabled?: boolean;
  fillHeight?: boolean;
}) {
  const { children, onFile, onFiles, onFolderFiles, disabled, fillHeight } = props;
  const zoneRef = useRef<HTMLDivElement>(null);
  const dragCountRef = useRef(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const isFileDrag = (event: React.DragEvent) => {
    const types = Array.from(event.dataTransfer?.types ?? []);
    return types.includes("Files");
  };

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    if (disabled) return;
    if (!isFileDrag(e)) return;
    if (!zoneRef.current?.contains(e.relatedTarget as Node)) {
      dragCountRef.current += 1;
      setIsDraggingOver(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    if (!zoneRef.current?.contains(e.relatedTarget as Node)) {
      dragCountRef.current = Math.max(0, dragCountRef.current - 1);
      setIsDraggingOver(dragCountRef.current > 0);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setIsDraggingOver(false);
    if (disabled) return;

    const dataTransferItems = Array.from(e.dataTransfer.items ?? []);
    const maybeEntries = dataTransferItems
      .map((item) => {
        const itemWithEntry = item as DataTransferItem & {
          webkitGetAsEntry?: () => FileSystemEntryLike | null;
        };
        return typeof itemWithEntry.webkitGetAsEntry === "function"
          ? itemWithEntry.webkitGetAsEntry()
          : null;
      })
      .filter(Boolean) as FileSystemEntryLike[];
    const hasDirectory = maybeEntries.some((entry) => entry.isDirectory);

    if (hasDirectory && onFolderFiles) {
      const allEntries = await Promise.all(
        maybeEntries.map((entry) => walkDroppedEntry(entry, "")),
      );
      const folderFiles = allEntries.flat();

      const validEntries: FolderUploadFile[] = [];
      const invalidFiles: string[] = [];
      for (const entry of folderFiles) {
        if (ACCEPTED_TYPES.has(entry.file.type)) {
          validEntries.push(entry);
        } else {
          invalidFiles.push(entry.file.name);
        }
      }

      if (invalidFiles.length > 0) {
        toast.error(
          `${invalidFiles.length} arquivo(s) com formato não suportado: ${invalidFiles.slice(0, 3).join(", ")}${invalidFiles.length > 3 ? "..." : ""}`,
        );
      }

      if (validEntries.length > 0) {
        onFolderFiles(validEntries);
      }
      return;
    }

    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    for (const file of files) {
      if (ACCEPTED_TYPES.has(file.type)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    }

    if (invalidFiles.length > 0) {
      toast.error(
        `${invalidFiles.length} arquivo(s) com formato não suportado: ${invalidFiles.slice(0, 3).join(", ")}${invalidFiles.length > 3 ? "..." : ""}`,
      );
    }

    if (validFiles.length === 0) return;

    if (validFiles.length === 1 && !onFiles) {
      onFile(validFiles[0]);
    } else if (onFiles) {
      onFiles(validFiles);
    } else {
      validFiles.forEach((file) => onFile(file));
    }
  }

  return (
    <div
      ref={zoneRef}
      className={cn(
        "relative",
        fillHeight
          ? "flex min-h-[calc(100vh-12rem)] flex-col"
          : "min-h-[200px]",
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      {isDraggingOver && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/90 text-center backdrop-blur-[2px] animate-in fade-in-0"
          aria-hidden
        >
          <p className="text-muted-foreground text-sm font-medium">
            Solte arquivos ou pastas para fazer upload
          </p>
        </div>
      )}
    </div>
  );
}

export function MediaClient(props: { initialItems?: MediaItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const media = useMediaLibrary({ initialItems: props.initialItems });
  const selection = useMediaSelection();

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; fileName: string | null } | null>(null);
  const [viewingItem, setViewingItem] = useState<MediaItem | null>(null);
  const [renameItem, setRenameItem] = useState<MediaItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [detailsItem, setDetailsItem] = useState<MediaItem | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(true);
  const [isDeletingSelection, setIsDeletingSelection] = useState(false);
  const [deletingCount, setDeletingCount] = useState(0);
  const [draggedMediaIds, setDraggedMediaIds] = useState<string[]>([]);
  const [movingMediaIds, setMovingMediaIds] = useState<string[]>([]);
  const [isMediaDragActive, setIsMediaDragActive] = useState(false);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const [dropTargetBreadcrumbKey, setDropTargetBreadcrumbKey] = useState<string | null>(null);
  const [isMovingToFolder, setIsMovingToFolder] = useState(false);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>("all");
  const [uploadDateFilter, setUploadDateFilter] = useState<UploadDateFilter>("all");

  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [createFolderName, setCreateFolderName] = useState("Pasta sem título");
  const [renameFolderTarget, setRenameFolderTarget] = useState<MediaFolder | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<MediaFolder | null>(null);
  const [creatingFolderTempId, setCreatingFolderTempId] = useState<string | null>(null);
  const [creatingFolderTempName, setCreatingFolderTempName] = useState<string | null>(null);
  const [creatingFolderParentId, setCreatingFolderParentId] = useState<string | null>(null);
  const [deletingFolderIds, setDeletingFolderIds] = useState<Set<string>>(new Set());
  const [pendingFolderUpload, setPendingFolderUpload] = useState<FolderUploadSummary | null>(null);
  const [folderUploadPhase, setFolderUploadPhase] = useState<{
    step: string;
    detail?: string;
    processed?: number;
    total?: number;
  } | null>(null);

  const emptyFileInputRef = useRef<HTMLInputElement>(null);
  const emptyFolderInputRef = useRef<HTMLInputElement>(null);
  const contextUploadInputRef = useRef<HTMLInputElement>(null);
  const contextFolderUploadInputRef = useRef<HTMLInputElement>(null);
  const folderNameInputRef = useRef<HTMLInputElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const didDragRef = useRef(false);

  const uploadProgressIds = media.uploadProgress.map((u) => u.fileId).join(",");
  useEffect(() => {
    if (media.uploadProgress.length > 0) {
      setShowUploadPanel(true);
    }
  }, [media.uploadProgress.length, uploadProgressIds]);

  useEffect(() => {
    if (!folderUploadPhase) return;
    if (!folderUploadPhase.step.startsWith("Enviando")) return;
    const completed = media.uploadProgress.filter(
      (item) =>
        item.status === "success" ||
        item.status === "replaced" ||
        item.status === "error" ||
        item.status === "cancelled",
    ).length;
    const total = folderUploadPhase.total ?? 0;
    setFolderUploadPhase((prev) => {
      if (!prev || !prev.step.startsWith("Enviando")) return prev;
      if ((prev.processed ?? 0) === completed && (prev.total ?? 0) === total) return prev;
      return {
        ...prev,
        processed: completed,
        total,
        detail: `${Math.min(completed, total)} de ${total}`,
      };
    });
  }, [folderUploadPhase, media.uploadProgress]);

  const folderById = useMemo(
    () => new Map(media.folders.map((folder) => [folder.id, folder] as const)),
    [media.folders],
  );
  const mediaById = useMemo(
    () => new Map(media.items.map((item) => [item.id, item] as const)),
    [media.items],
  );
  const draggedIdsSet = useMemo(() => new Set(draggedMediaIds), [draggedMediaIds]);
  const movingIdsSet = useMemo(() => new Set(movingMediaIds), [movingMediaIds]);

  const breadcrumbNodes = useMemo(
    () => buildBreadcrumbPath(media.folders, currentFolderId),
    [media.folders, currentFolderId],
  );

  const visibleFolders = useMemo(
    () => media.folders.filter((folder) => (folder.parentFolderId ?? null) === currentFolderId),
    [media.folders, currentFolderId],
  );
  const visibleFoldersWithOptimistic = useMemo(() => {
    if (!creatingFolderTempId || !creatingFolderTempName) return visibleFolders;
    if ((creatingFolderParentId ?? null) !== currentFolderId) return visibleFolders;
    const optimistic: MediaFolder = {
      id: creatingFolderTempId,
      name: creatingFolderTempName,
      parentFolderId: creatingFolderParentId ?? null,
      createdAt: null,
      updatedAt: null,
    };
    return [optimistic, ...visibleFolders];
  }, [
    visibleFolders,
    creatingFolderTempId,
    creatingFolderTempName,
    creatingFolderParentId,
    currentFolderId,
  ]);

  const visibleMediaItems = useMemo(
    () =>
      media.items
        .filter((item) => (item.folderId ?? null) === currentFolderId)
        .filter((item) => matchesMediaType(item, typeFilter))
        .filter((item) => matchesUploadDate(item, uploadDateFilter)),
    [media.items, currentFolderId, typeFilter, uploadDateFilter],
  );
  const isCurrentFolderEmpty = visibleFoldersWithOptimistic.length === 0 && visibleMediaItems.length === 0;

  const navigateToFolder = useCallback(
    (folderId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (folderId) params.set("folderId", folderId);
      else params.delete("folderId");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    if (selectedFolderId && !folderById.has(selectedFolderId)) {
      setSelectedFolderId(null);
    }
  }, [folderById, selectedFolderId]);

  useEffect(() => {
    if (currentFolderId && !folderById.has(currentFolderId)) {
      setCurrentFolderId(null);
      navigateToFolder(null);
    }
  }, [folderById, currentFolderId, navigateToFolder]);

  useEffect(() => {
    const folderIdFromUrl = searchParams.get("folderId");
    if (!folderIdFromUrl) {
      if (currentFolderId !== null) setCurrentFolderId(null);
      return;
    }
    if (folderById.has(folderIdFromUrl)) {
      if (currentFolderId !== folderIdFromUrl) setCurrentFolderId(folderIdFromUrl);
      return;
    }
    if (!media.isLoadingFolders && !media.isFetchingFolders) {
      setCurrentFolderId(null);
      navigateToFolder(null);
    }
  }, [
    searchParams,
    folderById,
    currentFolderId,
    media.isLoadingFolders,
    media.isFetchingFolders,
    navigateToFolder,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedFolderId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    selection.clearSelection();
  }, [currentFolderId, typeFilter, uploadDateFilter, selection.clearSelection]);

  useEffect(() => {
    void media.refetchMedia();
  }, [currentFolderId, media.refetchMedia]);

  useEffect(() => {
    if (!isCreateFolderOpen) return;
    setTimeout(() => {
      folderNameInputRef.current?.focus();
      folderNameInputRef.current?.select();
    }, 0);
  }, [isCreateFolderOpen]);

  const getCardsInSelection = useCallback(() => {
    if (!selection.selectionStart || !selection.selectionEnd || !gridContainerRef.current) {
      return [];
    }

    const startX = Math.min(selection.selectionStart.x, selection.selectionEnd.x);
    const endX = Math.max(selection.selectionStart.x, selection.selectionEnd.x);
    const startY = Math.min(selection.selectionStart.y, selection.selectionEnd.y);
    const endY = Math.max(selection.selectionStart.y, selection.selectionEnd.y);

    const selectedIds: string[] = [];

    cardRefsMap.current.forEach((cardEl, id) => {
      const cardRect = cardEl.getBoundingClientRect();
      const isIntersecting =
        cardRect.right >= startX &&
        cardRect.left <= endX &&
        cardRect.bottom >= startY &&
        cardRect.top <= endY;

      if (isIntersecting) {
        selectedIds.push(id);
      }
    });

    return selectedIds;
  }, [selection.selectionStart, selection.selectionEnd]);

  useEffect(() => {
    if (selection.isSelecting && selection.selectionStart && selection.selectionEnd) {
      const selectedIds = getCardsInSelection();
      if (selectedIds.length > 0) {
        selection.updateSelectedIds((prev) => {
          const newSet = new Set(prev);
          if (selection.selectionMode === "normal") {
            newSet.clear();
          }
          selectedIds.forEach((id) => newSet.add(id));
          return newSet;
        });
      }
    }
  }, [
    selection.isSelecting,
    selection.selectionStart,
    selection.selectionEnd,
    selection.selectionMode,
    selection.updateSelectedIds,
    getCardsInSelection,
  ]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (selection.isSelecting) {
        selection.updateSelection(e.clientX, e.clientY);
      }
    };

    const handleGlobalMouseUp = () => {
      if (selection.isSelecting) {
        const start = selection.selectionStart;
        const end = selection.selectionEnd;
        if (start && end) {
          const dx = Math.abs(end.x - start.x);
          const dy = Math.abs(end.y - start.y);
          if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
            didDragRef.current = true;
          }
        }
        selection.endSelection();
      }
    };

    if (selection.isSelecting) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [
    selection.isSelecting,
    selection.selectionStart,
    selection.selectionEnd,
    selection.updateSelection,
    selection.endSelection,
  ]);

  useEffect(() => {
    const endSelectionOnly = () => {
      selection.endSelection();
    };
    const endMediaDragStates = () => {
      setIsMediaDragActive(false);
      setDropTargetFolderId(null);
      setDropTargetBreadcrumbKey(null);
      setDraggedMediaIds([]);
    };
    window.addEventListener("dragstart", endSelectionOnly);
    window.addEventListener("dragend", endMediaDragStates);
    window.addEventListener("blur", endMediaDragStates);
    return () => {
      window.removeEventListener("dragstart", endSelectionOnly);
      window.removeEventListener("dragend", endMediaDragStates);
      window.removeEventListener("blur", endMediaDragStates);
    };
  }, [selection.endSelection]);

  const handleGridMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (isCurrentFolderEmpty) return;
      const target = e.target as HTMLElement;
      if (target.closest("[role='menu']")) return;
      if (target.closest("[data-media-card='true']")) return;
      if (target.closest("[data-media-item='true']")) return;
      if (!target.closest("[data-folder-item='true']")) {
        setSelectedFolderId(null);
      }

      didDragRef.current = false;
      const mode = e.ctrlKey || e.metaKey ? "add" : "normal";
      selection.startSelection(e.clientX, e.clientY, mode);
    },
    [isCurrentFolderEmpty, selection.startSelection],
  );

  const handleItemClick = useCallback(
    (item: MediaItem, e: React.MouseEvent | { stopPropagation: () => void }, mode: "normal" | "add" | "range") => {
      if ("stopPropagation" in e && typeof e.stopPropagation === "function") {
        e.stopPropagation();
      }
      setSelectedFolderId(null);
      if (mode === "range" && selection.selectedIds.size > 0) {
        const allIds = visibleMediaItems.map((i) => i.id);
        const lastSelected = Array.from(selection.selectedIds).pop();
        if (lastSelected) {
          selection.selectRange(lastSelected, item.id, allIds);
        }
      } else {
        selection.toggleSelection(item.id, mode);
      }
    },
    [selection.selectedIds, selection.selectRange, selection.toggleSelection, visibleMediaItems],
  );

  const handleDeleteSelected = useCallback(() => {
    const selectedArray = Array.from(selection.selectedIds);
    if (selectedArray.length === 0) return;

    const itemsToDelete = media.items.filter((item) => selection.selectedIds.has(item.id));
    if (itemsToDelete.length === 1) {
      setDeleteConfirm({ id: itemsToDelete[0].id, fileName: itemsToDelete[0].fileName });
    } else {
      setDeleteConfirm({ id: "multiple", fileName: null });
    }
  }, [selection.selectedIds, media.items]);

  const handleMediaDragStart = useCallback(
    (item: MediaItem, event: React.DragEvent<HTMLButtonElement>) => {
      const selectedIds = selection.selectedIds;
      const ids = selectedIds.has(item.id) ? Array.from(selectedIds) : [item.id];
      setDraggedMediaIds(ids);
      setIsMediaDragActive(true);
      setDropTargetFolderId(null);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(INTERNAL_MEDIA_DRAG_TYPE, JSON.stringify(ids));
      event.dataTransfer.setData("text/plain", `${ids.length}`);
      const dragLabel = ids.length === 1 ? "1 mídia" : `${ids.length} mídias`;
      event.currentTarget.setAttribute("aria-label", dragLabel);
      const ghost = document.createElement("div");
      ghost.style.position = "fixed";
      ghost.style.top = "-1000px";
      ghost.style.left = "-1000px";
      ghost.style.padding = "6px 10px";
      ghost.style.border = "1px solid rgba(14,165,233,0.45)";
      ghost.style.borderRadius = "8px";
      ghost.style.background = "rgba(255,255,255,0.96)";
      ghost.style.color = "#0f172a";
      ghost.style.fontSize = "12px";
      ghost.style.fontWeight = "600";
      ghost.style.boxShadow = "0 4px 12px rgba(2,6,23,0.18)";
      ghost.textContent = ids.length === 1 ? (item.fileName ?? "1 item") : `${ids.length} itens`;
      document.body.appendChild(ghost);
      event.dataTransfer.setDragImage(ghost, 12, 12);
      requestAnimationFrame(() => {
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      });
    },
    [selection.selectedIds],
  );

  const handleMediaDragEnd = useCallback(() => {
    setIsMediaDragActive(false);
    setDropTargetFolderId(null);
    setDropTargetBreadcrumbKey(null);
    setDraggedMediaIds([]);
  }, []);

  const handleDropToFolder = useCallback(
    async (folderId: string | null) => {
      const ids = draggedMediaIds.length > 0 ? draggedMediaIds : Array.from(selection.selectedIds);
      if (ids.length === 0) return;
      const effectiveIds = ids.filter((id) => (mediaById.get(id)?.folderId ?? null) !== folderId);
      setDropTargetFolderId(null);
      setDropTargetBreadcrumbKey(null);
      setIsMediaDragActive(false);
      setDraggedMediaIds([]);
      if (effectiveIds.length === 0) return;
      setMovingMediaIds(effectiveIds);
      selection.clearSelection();
      setIsMovingToFolder(true);
      try {
        await media.moveItemsToFolder(effectiveIds, folderId);
      } finally {
        setIsMovingToFolder(false);
        setMovingMediaIds([]);
      }
    },
    [draggedMediaIds, selection.selectedIds, mediaById, media, selection.clearSelection],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest("input, textarea") || active?.isContentEditable) return;
      e.preventDefault();
      if (selection.selectedIds.size > 0) {
        handleDeleteSelected();
        return;
      }
      if (selectedFolderId) {
        const folder = folderById.get(selectedFolderId);
        if (folder) setDeleteFolderTarget(folder);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selection.selectedIds.size, handleDeleteSelected, selectedFolderId, folderById]);

  function openRename(item: MediaItem) {
    setRenameItem(item);
    setRenameValue(item.fileName ?? "");
  }

  function submitRename() {
    if (!renameItem || !renameValue.trim()) return;
    void media.renameItem(renameItem.id, renameValue.trim());
    setRenameItem(null);
  }

  function openCreateFolderDialog() {
    setCreateFolderName("Pasta sem título");
    setIsCreateFolderOpen(true);
  }

  async function submitCreateFolder() {
    const name = createFolderName.trim() || "Pasta sem título";
    const tempId = `temp-folder-${Date.now()}`;
    setCreatingFolderTempId(tempId);
    setCreatingFolderTempName(name);
    setCreatingFolderParentId(currentFolderId ?? null);
    try {
      const created = await media.createFolder(name, currentFolderId);
      setSelectedFolderId(created.id);
      setIsCreateFolderOpen(false);
      setCreateFolderName("Pasta sem título");
    } catch {
      // handled by hook
    } finally {
      setCreatingFolderTempId(null);
      setCreatingFolderTempName(null);
      setCreatingFolderParentId(null);
    }
  }

  function openRenameFolderDialog(folder: MediaFolder) {
    setRenameFolderTarget(folder);
    setRenameFolderValue(folder.name);
  }

  async function submitRenameFolder() {
    if (!renameFolderTarget || !renameFolderValue.trim()) return;
    try {
      await media.renameFolder(renameFolderTarget.id, renameFolderValue.trim());
      setRenameFolderTarget(null);
      setRenameFolderValue("");
    } catch {
      // handled by hook
    }
  }

  async function handleUploadInputFiles(files: File[]) {
    if (files.length === 0) return;
    if (files.length === 1) {
      await media.onPickFile(files[0], { folderId: currentFolderId });
      return;
    }
    await media.onPickFiles(files, { folderId: currentFolderId });
  }

  function openFolderUploadSummary(entries: FolderUploadFile[]) {
    if (entries.length === 0) return;
    const rootCounts = new Map<string, number>();
    for (const entry of entries) {
      const [root] = sanitizeRelativePath(entry.relativePath).split("/");
      if (!root) continue;
      rootCounts.set(root, (rootCounts.get(root) ?? 0) + 1);
    }
    const siblings = media.folders.filter((folder) => (folder.parentFolderId ?? null) === currentFolderId);
    const siblingByName = new Map(
      siblings.map((folder) => [normalizeComparableName(folder.name), folder.id] as const),
    );

    const roots = Array.from(rootCounts.entries()).map(([name, count]) => ({
      name,
      count,
      willMerge: siblingByName.has(normalizeComparableName(name)),
    }));
    const targetLabel = currentFolderId
      ? folderById.get(currentFolderId)?.name ?? "Pasta atual"
      : "Biblioteca de mídia";

    setPendingFolderUpload({ entries, roots, targetLabel });
  }

  async function confirmFolderUpload() {
    if (!pendingFolderUpload) return;
    const { entries, roots } = pendingFolderUpload;
    setPendingFolderUpload(null);
    if (entries.length === 0) return;

    setFolderUploadPhase({
      step: "Lendo pasta...",
      detail: `${entries.length} arquivo(s) detectado(s).`,
      processed: 0,
      total: entries.length,
    });

    try {
      const folderPaths = Array.from(
        new Set(
          entries
            .map((entry) => getFolderPathFromRelativePath(entry.relativePath))
            .filter(Boolean),
        ),
      );

      setFolderUploadPhase({
        step: "Mesclando estrutura de pastas...",
        detail: `Analisando ${folderPaths.length || 1} caminho(s).`,
        processed: 0,
        total: entries.length,
      });

      let folderIdByPath = new Map<string, string>();
      if (folderPaths.length > 0) {
        folderIdByPath = await media.resolveFolderTree(folderPaths, currentFolderId);
      }

      const files = entries.map((entry) => entry.file);
      const folderIdsByIndex = entries.map((entry) => {
        const folderPath = getFolderPathFromRelativePath(entry.relativePath);
        if (!folderPath) return currentFolderId;
        return folderIdByPath.get(folderPath) ?? currentFolderId;
      });

      setFolderUploadPhase({
        step: "Enviando arquivos...",
        detail: `0 de ${files.length}`,
        processed: 0,
        total: files.length,
      });

      const result = await media.onPickFiles(files, {
        folderId: currentFolderId,
        dedupeMode: "replace_by_name_ext",
        getFolderId: (_file, index) => folderIdsByIndex[index] ?? currentFolderId,
      });

      setFolderUploadPhase({
        step: "Finalizando...",
        detail: "Atualizando biblioteca.",
        processed: files.length,
        total: files.length,
      });
      await media.refetchFolders();

      const uploaded = result?.uploaded ?? files.length;
      const replaced = result?.replaced ?? 0;
      const failed = result?.failed ?? 0;

      if (failed > 0) {
        toast.warning(
          `Upload concluído com alertas: ${uploaded} enviado(s), ${replaced} substituído(s), ${failed} falha(s).`,
        );
      }
    } catch {
      // handled by hook
    } finally {
      setFolderUploadPhase(null);
    }
  }

  async function confirmDeleteFolder() {
    if (!deleteFolderTarget) return;
    const target = deleteFolderTarget;
    setDeleteFolderTarget(null);
    setDeletingFolderIds((prev) => {
      const next = new Set(prev);
      next.add(target.id);
      return next;
    });
    try {
      await media.deleteFolder(target.id);
      if (currentFolderId === target.id) {
        setCurrentFolderId(target.parentFolderId ?? null);
        navigateToFolder(target.parentFolderId ?? null);
      }
      if (selectedFolderId === target.id) {
        setSelectedFolderId(null);
      }
    } catch {
      // handled by hook
    } finally {
      setDeletingFolderIds((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
    }
  }

  const dropZoneDisabled = media.isBusy || !media.canUpload;

  const selectedCount = selection.selectedIds.size;
  const showSelectionToolbar = selectedCount > 0 || isDeletingSelection;
  const showDeletingState = media.isDeletingBatch || isDeletingSelection;
  const countForToolbar = deletingCount || selectedCount;

  const isLoadingLibrary = media.isLoading || media.isLoadingFolders;
  const isWorkspaceEmpty = media.items.length === 0 && media.folders.length === 0;

  return (
    <div className="space-y-4">
      <input
        ref={contextUploadInputRef}
        type="file"
        accept={ACCEPT_IMAGES}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void handleUploadInputFiles(files);
        }}
      />
      <input
        ref={contextFolderUploadInputRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []) as NativeFileWithRelativePath[];
          e.target.value = "";
          const entries = files.map((file) => ({
            file,
            relativePath: sanitizeRelativePath(file.webkitRelativePath || file.name),
          }));
          openFolderUploadSummary(entries);
        }}
      />

      {media.error && <p className="text-destructive text-sm">{media.error}</p>}

      {folderUploadPhase && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/55 backdrop-blur-[1px]">
          <div className="w-[min(92vw,420px)] rounded-xl border bg-background p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <Spinner className="size-5 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">{folderUploadPhase.step}</p>
                {folderUploadPhase.detail ? (
                  <p className="text-muted-foreground text-xs">{folderUploadPhase.detail}</p>
                ) : null}
              </div>
            </div>
            {typeof folderUploadPhase.total === "number" && folderUploadPhase.total > 0 ? (
              <div className="mt-3">
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{
                      width: `${Math.max(
                        8,
                        Math.min(
                          100,
                          (((folderUploadPhase.processed ?? 0) / folderUploadPhase.total) || 0) * 100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <Breadcrumb>
            <BreadcrumbList className="gap-2 text-foreground">
            {breadcrumbNodes.map((node, index) => {
              const isLast = index === breadcrumbNodes.length - 1;
              const isAncestor = index < breadcrumbNodes.length - 1;
              const nodeDropKey = node.id ?? BREADCRUMB_ROOT_DROP_KEY;
              const isBreadcrumbDropTarget =
                isMediaDragActive && dropTargetBreadcrumbKey === nodeDropKey;
              return (
                <BreadcrumbItem key={node.id ?? "root"}>
                  <div
                    className="rounded-md"
                    onDragEnter={(e) => {
                      if (!isMediaDragActive) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setDropTargetFolderId(null);
                      setDropTargetBreadcrumbKey(nodeDropKey);
                    }}
                    onDragOver={(e) => {
                      if (!isMediaDragActive) return;
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "move";
                      setDropTargetFolderId(null);
                      setDropTargetBreadcrumbKey(nodeDropKey);
                    }}
                    onDragLeave={(e) => {
                      if (!isMediaDragActive) return;
                      const hovered = document.elementFromPoint(e.clientX, e.clientY);
                      if (hovered && e.currentTarget.contains(hovered)) return;
                      if (dropTargetBreadcrumbKey === nodeDropKey) {
                        setDropTargetBreadcrumbKey(null);
                      }
                    }}
                    onDrop={(e) => {
                      if (!isMediaDragActive) return;
                      e.preventDefault();
                      e.stopPropagation();
                      void handleDropToFolder(node.id ?? null);
                    }}
                  >
                    {isLast ? (
                      <BreadcrumbPage
                        className={cn(
                          "inline-flex items-center rounded-md border border-transparent px-2 py-1 text-2xl font-semibold text-foreground",
                          isBreadcrumbDropTarget && "border-primary/40 bg-primary/10",
                        )}
                      >
                        {node.name}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        asChild
                        className={cn(
                          "cursor-pointer text-2xl font-semibold text-foreground transition-opacity",
                          isAncestor ? "opacity-70 hover:opacity-100" : "opacity-100",
                        )}
                      >
                        <button
                          type="button"
                          className={cn(
                            "inline-flex items-center rounded-md border border-transparent px-2 py-1",
                            isBreadcrumbDropTarget && "border-primary/40 bg-primary/10 opacity-100",
                          )}
                          onClick={() => {
                          setCurrentFolderId(node.id);
                          setSelectedFolderId(null);
                          navigateToFolder(node.id);
                        }}
                      >
                          {node.name}
                        </button>
                      </BreadcrumbLink>
                    )}
                  </div>
                  {!isLast ? (
                    <BreadcrumbSeparator className={cn(isAncestor ? "text-foreground/70" : "text-foreground")}>
                      <FaChevronRight className="size-3" />
                    </BreadcrumbSeparator>
                  ) : null}
                </BreadcrumbItem>
              );
            })}
            </BreadcrumbList>
          </Breadcrumb>
          <MediaUploadAction initialItems={props.initialItems} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-10 rounded-xl px-4 text-sm font-medium"
              >
                <span className="text-sm">
                  {typeFilter === "all"
                    ? "Tipo"
                    : typeFilter === "image"
                      ? "Imagem"
                      : "Vídeo"}
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              <DropdownMenuItem onClick={() => setTypeFilter("image")}>
                Imagem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("video")}>
                Vídeo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTypeFilter("all")}>
                Limpar filtro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-10 rounded-xl px-4 text-sm font-medium"
              >
                <span className="text-sm">
                  {uploadDateFilter === "all"
                    ? "Data de upload"
                    : uploadDateFilter === "today"
                      ? "Hoje"
                      : uploadDateFilter === "yesterday"
                        ? "Ontem"
                        : uploadDateFilter === "last7days"
                          ? "Últimos 7 dias"
                          : "Último mês"}
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px]">
              <DropdownMenuItem onClick={() => setUploadDateFilter("today")}>
                Hoje
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setUploadDateFilter("yesterday")}>
                Ontem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setUploadDateFilter("last7days")}>
                Últimos 7 dias
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setUploadDateFilter("lastMonth")}>
                Último mês
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setUploadDateFilter("all")}>
                Limpar filtro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {showSelectionToolbar && (
        <div className="fixed bottom-4 left-3 right-3 z-50 flex flex-wrap items-center gap-3 rounded-lg border bg-background px-3 py-3 shadow-lg animate-in slide-in-from-bottom-4 sm:left-auto sm:right-4 sm:px-4">
          {showDeletingState ? (
            <>
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">
                Excluindo {countForToolbar} {countForToolbar === 1 ? "item..." : "itens..."}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">
                {selectedCount} {selectedCount === 1 ? "item selecionado" : "itens selecionados"}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selection.clearSelection}>
                  Desmarcar
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                  Excluir selecionados
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {showUploadPanel && media.uploadProgress.length > 0 && (
        <UploadProgressPanel
          uploads={media.uploadProgress}
          onCancel={media.cancelUpload}
          onClose={() => setShowUploadPanel(false)}
          selectedCount={selectedCount}
        />
      )}

      {isLoadingLibrary ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : (
        <DropZone
          onFile={(file) => {
            void media.onPickFile(file, { folderId: currentFolderId });
          }}
          onFiles={(files) => {
            void media.onPickFiles(files, { folderId: currentFolderId });
          }}
          onFolderFiles={(entries) => {
            openFolderUploadSummary(entries);
          }}
          disabled={dropZoneDisabled}
          fillHeight
        >
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                ref={gridContainerRef}
                className="relative min-h-[calc(100vh-12rem)] space-y-4 pt-2"
                onMouseDown={handleGridMouseDown}
                aria-hidden={selection.isSelecting}
              >
                <SelectionOverlay
                  start={selection.selectionStart}
                  end={selection.selectionEnd}
                  visible={selection.isSelecting}
                />
                {isWorkspaceEmpty ? (
                  <Empty className="min-h-[420px] border border-dashed">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <ImageIcon className="size-6" />
                      </EmptyMedia>
                      <EmptyTitle>Sua biblioteca está vazia</EmptyTitle>
                      <EmptyDescription>
                        Clique com o botão direito para criar uma pasta ou enviar imagens. Formatos: JPEG, PNG, WEBP ou HEIC.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <input
                        ref={emptyFileInputRef}
                        type="file"
                        accept={ACCEPT_IMAGES}
                        multiple
                        className="hidden"
                        aria-hidden
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          e.target.value = "";
                          void handleUploadInputFiles(files);
                        }}
                      />
                      <input
                        ref={emptyFolderInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []) as NativeFileWithRelativePath[];
                          e.target.value = "";
                          const entries = files.map((file) => ({
                            file,
                            relativePath: sanitizeRelativePath(file.webkitRelativePath || file.name),
                          }));
                          openFolderUploadSummary(entries);
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={media.isBusy || !media.canUpload}
                        onClick={() => emptyFileInputRef.current?.click()}
                      >
                        {media.uploadPending ? (
                          <span className="flex items-center gap-2">
                            <Spinner className="size-4 shrink-0" />
                            Enviando...
                          </span>
                        ) : (
                          "Enviar imagem"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={media.isBusy || !media.canUpload}
                        onClick={() => emptyFolderInputRef.current?.click()}
                      >
                        Enviar pasta
                      </Button>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <>
                    <FolderGrid
                      folders={visibleFoldersWithOptimistic}
                      selectedFolderId={selectedFolderId}
                      dropTargetFolderId={dropTargetFolderId}
                      isMediaDragActive={isMediaDragActive}
                      creatingFolderId={creatingFolderTempId}
                      deletingFolderIds={deletingFolderIds}
                      onSelectFolder={(id) => {
                        if (id.startsWith("temp-folder-")) return;
                        setSelectedFolderId(id);
                        selection.clearSelection();
                      }}
                      onOpenFolder={(id) => {
                        if (id.startsWith("temp-folder-")) return;
                        setCurrentFolderId(id);
                        setSelectedFolderId(null);
                        navigateToFolder(id);
                      }}
                      onRequestRenameFolder={openRenameFolderDialog}
                      onRequestDeleteFolder={setDeleteFolderTarget}
                      onDragEnterFolder={(id) => {
                        setDropTargetBreadcrumbKey(null);
                        setDropTargetFolderId(id);
                      }}
                      onDragLeaveFolder={(id) => {
                        if (dropTargetFolderId === id) setDropTargetFolderId(null);
                      }}
                      onDropToFolder={(id) => {
                        void handleDropToFolder(id);
                      }}
                    />

                    {isCurrentFolderEmpty ? (
                      <div className="flex min-h-[260px] flex-col items-center justify-center px-4 text-center">
                        <img
                          src="/empty_folder_state_illustration_sm.webp"
                          alt="Pasta vazia"
                          className="mb-4 h-auto w-[140px] max-w-[35vw] object-contain"
                        />
                        <p className="text-xl font-semibold text-foreground">Ainda não há nada aqui</p>
                        <p className="mt-2 text-sm text-foreground/80">
                          Arraste itens para cá ou clique em "Enviar imagens".
                        </p>
                      </div>
                    ) : (
                      <div className="flex min-h-0 flex-1">
                        <MediaGrid
                          items={visibleMediaItems}
                          deletingIds={media.deletingIds}
                          uploadPending={media.uploadPending}
                          selectedIds={selection.selectedIds}
                          draggedIds={draggedIdsSet}
                          movingIds={movingIdsSet}
                          cardRefs={cardRefsMap}
                          didDragRef={didDragRef}
                          onItemClick={handleItemClick}
                          onRequestView={setViewingItem}
                          onRequestRename={openRename}
                          onRequestDelete={(id, fileName) => setDeleteConfirm({ id, fileName })}
                          onRequestDetails={setDetailsItem}
                          onDragStart={handleMediaDragStart}
                          onDragEnd={handleMediaDragEnd}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={openCreateFolderDialog}>
                <FiFolderPlus className="mr-2 size-4" />
                Criar pasta
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                disabled={media.isBusy || !media.canUpload || isMovingToFolder}
                onClick={() => contextUploadInputRef.current?.click()}
              >
                <LuImagePlus className="mr-2 size-4" />
                Enviar imagem
              </ContextMenuItem>
              <ContextMenuItem
                disabled={media.isBusy || !media.canUpload || isMovingToFolder}
                onClick={() => contextFolderUploadInputRef.current?.click()}
              >
                <FiFolderPlus className="mr-2 size-4" />
                Enviar pasta
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          {viewingItem && <Lightbox item={viewingItem} onClose={() => setViewingItem(null)} />}

          <MediaDetailsSheet
            open={!!detailsItem}
            onOpenChange={(open) => !open && setDetailsItem(null)}
            item={detailsItem}
            onRequestView={(item) => {
              setDetailsItem(null);
              setViewingItem(item);
            }}
            onRequestRename={(item) => {
              setDetailsItem(null);
              openRename(item);
            }}
            onRequestDelete={(id, fileName) => {
              setDetailsItem(null);
              setDeleteConfirm({ id, fileName });
            }}
          />

          <Dialog open={!!pendingFolderUpload} onOpenChange={(open) => !open && setPendingFolderUpload(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Revisar upload de pasta</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <p className="text-muted-foreground text-sm">
                  Destino: <span className="text-foreground font-medium">{pendingFolderUpload?.targetLabel}</span>
                </p>
                <div className="max-h-52 space-y-2 overflow-y-auto p-1">
                  {(pendingFolderUpload?.roots ?? []).map((root) => (
                    <div key={root.name} className="flex items-center justify-between gap-3 rounded-md border px-2 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{root.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {root.count} arquivo(s)
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          root.willMerge
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700",
                        )}
                      >
                        {root.willMerge ? "Vai mesclar" : "Vai criar"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  Arquivos com o mesmo nome e extensão no mesmo destino serão substituídos.
                </p>
              </div>
              <DialogFooter showCloseButton={false}>
                <Button variant="outline" onClick={() => setPendingFolderUpload(null)}>
                  Cancelar
                </Button>
                <Button onClick={() => void confirmFolderUpload()}>
                  Continuar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!renameItem} onOpenChange={(open) => !open && setRenameItem(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Renomear arquivo</DialogTitle>
              </DialogHeader>
              <div className="py-2">
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="Nome do arquivo"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename();
                  }}
                />
              </div>
              <DialogFooter showCloseButton={false}>
                <Button variant="outline" onClick={() => setRenameItem(null)}>
                  Cancelar
                </Button>
                <Button onClick={submitRename} disabled={!renameValue.trim()}>
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova pasta</DialogTitle>
              </DialogHeader>
              <div className="py-2">
                <Input
                  ref={folderNameInputRef}
                  value={createFolderName}
                  onChange={(e) => setCreateFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitCreateFolder();
                  }}
                />
              </div>
              <DialogFooter showCloseButton={false}>
                <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => void submitCreateFolder()} disabled={!createFolderName.trim() || media.isCreatingFolder}>
                  {media.isCreatingFolder ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={!!renameFolderTarget}
            onOpenChange={(open) => {
              if (!open) {
                setRenameFolderTarget(null);
                setRenameFolderValue("");
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Renomear pasta</DialogTitle>
              </DialogHeader>
              <div className="py-2">
                <Input
                  value={renameFolderValue}
                  onChange={(e) => setRenameFolderValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitRenameFolder();
                  }}
                />
              </div>
              <DialogFooter showCloseButton={false}>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRenameFolderTarget(null);
                    setRenameFolderValue("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => void submitRenameFolder()}
                  disabled={!renameFolderValue.trim() || media.isRenamingFolder}
                >
                  {media.isRenamingFolder ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog
            open={!!deleteFolderTarget}
            onOpenChange={(open) => {
              if (!open) setDeleteFolderTarget(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteFolderTarget
                    ? `A pasta "${deleteFolderTarget.name}" será removida. A pasta precisa estar vazia para ser excluída.`
                    : "A pasta será removida."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void confirmDeleteFolder()}>
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {deleteConfirm?.id === "multiple" ? "Excluir mídias selecionadas?" : "Excluir mídia?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteConfirm?.id === "multiple"
                    ? `${selectedCount} mídia(s) serão removida(s) permanentemente. Esta ação não pode ser desfeita.`
                    : deleteConfirm?.fileName
                      ? `"${deleteConfirm.fileName}" será removido permanentemente. Esta ação não pode ser desfeita.`
                      : "Esta mídia será removida permanentemente. Esta ação não pode ser desfeita."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={async () => {
                    if (!deleteConfirm) return;
                    if (deleteConfirm.id === "multiple") {
                      const idsToDelete = Array.from(selection.selectedIds);
                      setDeleteConfirm(null);
                      setIsDeletingSelection(true);
                      setDeletingCount(idsToDelete.length);
                      await new Promise((r) => setTimeout(r, 0));
                      try {
                        await media.deleteBatch(idsToDelete);
                      } finally {
                        selection.clearSelection();
                        setIsDeletingSelection(false);
                        setDeletingCount(0);
                      }
                    } else {
                      const idToDelete = deleteConfirm.id;
                      setDeleteConfirm(null);
                      await media.deleteItem(idToDelete);
                    }
                  }}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropZone>
      )}
    </div>
  );
}

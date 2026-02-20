"use client";

import { useEffect, useId, useRef, useState, useCallback } from "react";

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
import { useMediaLibrary, type MediaItem } from "@/hooks/use-media-library";
import { UploadProgressPanel } from "@/components/media/upload-progress-panel";
import { SelectionOverlay } from "@/components/media/selection-overlay";
import { MediaDetailsSheet } from "@/components/media/media-details-sheet";
import { useMediaSelection } from "@/hooks/use-media-selection";
import { ImageIcon, TrashIcon, HelpCircle, Eye, Pencil, Info, Loader2 } from "lucide-react";
import { FaImage, FaVideo } from "react-icons/fa";
import { SlOptionsVertical } from "react-icons/sl";
import { Input } from "@/components/ui/input";
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

function MediaGrid(props: {
  items: MediaItem[];
  deletingId: string | null;
  uploadPending?: boolean;
  selectedIds: Set<string>;
  didDragRef?: React.MutableRefObject<boolean>;
  onItemClick(item: MediaItem, e: React.MouseEvent, mode: "normal" | "add" | "range"): void;
  onRequestView(item: MediaItem): void;
  onRequestRename(item: MediaItem): void;
  onRequestDelete(id: string, fileName: string | null): void;
  onRequestDetails(item: MediaItem): void;
  cardRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
      {props.items.map((m) => {
        const isDeleting = props.deletingId === m.id;
        const isSelected = props.selectedIds.has(m.id);
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
                ref={(el) => {
                  if (el && props.cardRefs) props.cardRefs.current.set(m.id, el);
                  else if (props.cardRefs) props.cardRefs.current.delete(m.id);
                }}
                className={cn(
                  "overflow-hidden gap-0 p-0 transition-all select-none cursor-pointer",
                  isSelected && "ring-2 ring-primary ring-offset-2",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "relative block w-full aspect-4/3 bg-zinc-100 dark:bg-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 select-none",
                  )}
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
            </button>
            <div className="flex items-center justify-between gap-2 p-2">
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
  disabled?: boolean;
  fillHeight?: boolean;
}) {
  const { children, onFile, onFiles, disabled, fillHeight } = props;
  const zoneRef = useRef<HTMLDivElement>(null);
  const dragCountRef = useRef(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    if (disabled) return;
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
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setIsDraggingOver(false);
    if (disabled) return;
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
            Solte os arquivos para fazer upload
          </p>
        </div>
      )}
    </div>
  );
}

export function MediaClient(props: { initialItems?: MediaItem[] }) {
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
  const emptyFileInputRef = useRef<HTMLInputElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const didDragRef = useRef(false);

  const uploadProgressIds = media.uploadProgress.map((u) => u.fileId).join(",");
  useEffect(() => {
    if (media.uploadProgress.length > 0) {
      setShowUploadPanel(true);
    }
  }, [media.uploadProgress.length, uploadProgressIds]);

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
  }, [selection, getCardsInSelection]);

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
  }, [selection]);

  const handleGridMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("[role='menu']")) return;

      didDragRef.current = false;
      const mode = e.ctrlKey || e.metaKey ? "add" : "normal";
      selection.startSelection(e.clientX, e.clientY, mode);
    },
    [selection],
  );

  const handleGridMouseUp = useCallback(() => {
    selection.endSelection();
  }, [selection]);

  const handleItemClick = useCallback(
    (item: MediaItem, e: React.MouseEvent | { stopPropagation: () => void }, mode: "normal" | "add" | "range") => {
      if ("stopPropagation" in e && typeof e.stopPropagation === "function") {
        e.stopPropagation();
      }
      if (mode === "range" && selection.selectedIds.size > 0) {
        const allIds = media.items.map((i) => i.id);
        const lastSelected = Array.from(selection.selectedIds).pop();
        if (lastSelected) {
          selection.selectRange(lastSelected, item.id, allIds);
        }
      } else {
        selection.toggleSelection(item.id, mode);
      }
    },
    [selection, media.items],
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest("input, textarea") || active?.isContentEditable) return;
      if (selection.selectedIds.size === 0) return;
      e.preventDefault();
      handleDeleteSelected();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selection.selectedIds.size, handleDeleteSelected]);

  function openRename(item: MediaItem) {
    setRenameItem(item);
    setRenameValue(item.fileName ?? "");
  }

  function submitRename() {
    if (!renameItem || !renameValue.trim()) return;
    media.renameItem(renameItem.id, renameValue.trim());
    setRenameItem(null);
  }

  const dropZoneDisabled = media.isBusy || !media.canUpload;

  const selectedCount = selection.selectedIds.size;
  const showSelectionToolbar = selectedCount > 0 || isDeletingSelection;
  const showDeletingState = media.isDeletingBatch || isDeletingSelection;
  const countForToolbar = deletingCount || selectedCount;

  return (
    <div className="space-y-4">
      {media.error && <p className="text-destructive text-sm">{media.error}</p>}

      {showSelectionToolbar && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg animate-in slide-in-from-bottom-4">
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

      {media.isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : media.items.length === 0 ? (
        <DropZone
          onFile={media.onPickFile}
          onFiles={media.onPickFiles}
          disabled={dropZoneDisabled}
          fillHeight
        >
          <Empty className="min-h-full border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImageIcon className="size-6" />
              </EmptyMedia>
              <EmptyTitle>Sua biblioteca está vazia</EmptyTitle>
              <EmptyDescription>
                Arraste arquivos para cá ou use o botão abaixo. Formatos: JPEG, PNG, WEBP ou HEIC. Máximo 10MB por arquivo.
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
                  if (files.length === 0) return;
                  e.target.value = "";
                  if (files.length === 1) {
                    media.onPickFile(files[0]);
                  } else if (media.onPickFiles) {
                    media.onPickFiles(files);
                  } else {
                    files.forEach((file) => media.onPickFile(file));
                  }
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
            </EmptyContent>
          </Empty>
        </DropZone>
      ) : (
        <DropZone
          onFile={media.onPickFile}
          onFiles={media.onPickFiles}
          disabled={dropZoneDisabled}
          fillHeight
        >
          <div
            className="flex min-h-0 flex-1"
            onMouseDown={handleGridMouseDown}
            aria-hidden={selection.isSelecting}
          >
            <div ref={gridContainerRef} className="relative w-full">
              <SelectionOverlay
                start={selection.selectionStart}
                end={selection.selectionEnd}
                visible={selection.isSelecting}
              />
              <MediaGrid
              items={media.items}
              deletingId={media.deletingId}
              uploadPending={media.uploadPending}
              selectedIds={selection.selectedIds}
              cardRefs={cardRefsMap}
              didDragRef={didDragRef}
              onItemClick={handleItemClick}
              onRequestView={setViewingItem}
              onRequestRename={openRename}
              onRequestDelete={(id, fileName) => setDeleteConfirm({ id, fileName })}
              onRequestDetails={setDetailsItem}
              />
            </div>
          </div>

          {viewingItem && (
            <Lightbox
              item={viewingItem}
              onClose={() => setViewingItem(null)}
            />
          )}

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


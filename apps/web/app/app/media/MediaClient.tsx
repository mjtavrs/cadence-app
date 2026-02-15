"use client";

import { useEffect, useId, useRef, useState } from "react";

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMediaLibrary, type MediaItem } from "@/hooks/use-media-library";
import { ImageIcon, TrashIcon, HelpCircle, Eye, Pencil } from "lucide-react";
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
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void media.onPickFile(file);
          e.target.value = "";
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
          "Enviar imagem"
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

function MediaGrid(props: {
  items: MediaItem[];
  deletingId: string | null;
  uploadPending?: boolean;
  onRequestView(item: MediaItem): void;
  onRequestRename(item: MediaItem): void;
  onRequestDelete(id: string, fileName: string | null): void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
      {props.items.map((m) => {
        const isDeleting = props.deletingId === m.id;
        return (
          <Card key={m.id} className="overflow-hidden gap-0 p-0">
            <button
              type="button"
              className="relative block w-full aspect-4/3 bg-zinc-100 dark:bg-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onDoubleClick={() => props.onRequestView(m)}
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
                <span className="truncate text-sm font-medium">{m.fileName ?? m.id}</span>
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
                  <DropdownMenuItem onClick={() => props.onRequestRename(m)}>
                    <Pencil className="size-4" />
                    Renomear
                  </DropdownMenuItem>
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
        );
      })}
      {props.uploadPending && (
        <Card key="uploading-placeholder" className="overflow-hidden gap-0 p-0" aria-busy>
          <div className="relative flex w-full aspect-4/3 flex-col items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-900">
            <Spinner className="size-8 text-primary" />
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
  disabled?: boolean;
  fillHeight?: boolean;
}) {
  const { children, onFile, disabled, fillHeight } = props;
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
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type)) {
      toast.error("Formato não suportado. Use JPEG, PNG, WEBP ou HEIC.");
      return;
    }
    onFile(file);
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
            Solte o arquivo para fazer upload
          </p>
        </div>
      )}
    </div>
  );
}

export function MediaClient(props: { initialItems?: MediaItem[] }) {
  const media = useMediaLibrary({ initialItems: props.initialItems });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; fileName: string | null } | null>(null);
  const [viewingItem, setViewingItem] = useState<MediaItem | null>(null);
  const [renameItem, setRenameItem] = useState<MediaItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const emptyFileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="space-y-4">
      {media.error && <p className="text-destructive text-sm">{media.error}</p>}

      {media.isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : media.items.length === 0 ? (
        <DropZone onFile={media.onPickFile} disabled={dropZoneDisabled} fillHeight>
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
                className="hidden"
                aria-hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    media.onPickFile(file);
                    e.target.value = "";
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
        <DropZone onFile={media.onPickFile} disabled={dropZoneDisabled} fillHeight>
          <MediaGrid
            items={media.items}
            deletingId={media.deletingId}
            uploadPending={media.uploadPending}
            onRequestView={setViewingItem}
            onRequestRename={openRename}
            onRequestDelete={(id, fileName) => setDeleteConfirm({ id, fileName })}
          />

          {viewingItem && (
            <Lightbox
              item={viewingItem}
              onClose={() => setViewingItem(null)}
            />
          )}

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
                <AlertDialogTitle>Excluir mídia?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteConfirm?.fileName
                    ? `"${deleteConfirm.fileName}" será removido permanentemente. Esta ação não pode ser desfeita.`
                    : "Esta mídia será removida permanentemente. Esta ação não pode ser desfeita."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    if (deleteConfirm) {
                      media.deleteItem(deleteConfirm.id);
                      setDeleteConfirm(null);
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


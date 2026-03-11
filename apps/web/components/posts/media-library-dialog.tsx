"use client";

import { useRef, useState } from "react";
import { FaCheck } from "react-icons/fa";
import { HiOutlineSquares2X2 } from "react-icons/hi2";
import { IoList } from "react-icons/io5";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type MediaLibraryItem = {
  id: string;
  url: string;
  fileName: string | null;
  createdAt: string;
};

type MediaViewMode = "thumbnail" | "list";

type HoverPreviewState = {
  media: MediaLibraryItem;
  x: number;
  y: number;
};

const PREVIEW_DELAY_MS = 700;
const PREVIEW_WIDTH = 220;

const mediaDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatMediaDate(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return mediaDateFormatter.format(dt);
}

function clampPreviewPosition(params: {
  hostRect: DOMRect;
  anchorRect: DOMRect;
}) {
  const margin = 12;
  const previewHeight = 280;
  let x = params.anchorRect.left - params.hostRect.left;
  let y = params.anchorRect.bottom - params.hostRect.top + 12;

  if (x + PREVIEW_WIDTH > params.hostRect.width - margin) {
    x = params.hostRect.width - PREVIEW_WIDTH - margin;
  }
  if (x < margin) x = margin;

  if (y + previewHeight > params.hostRect.height - margin) {
    y = Math.max(margin, params.anchorRect.top - params.hostRect.top - previewHeight - 12);
  }

  return { x, y };
}

function ViewModeIcon(props: { active: boolean; icon: React.ReactNode }) {
  return (
    <span className="inline-flex items-center">
      <span
        className={cn(
          "inline-flex items-center overflow-hidden transition-all duration-200 ease-out",
          props.active ? "mr-1.5 max-w-4 opacity-100" : "mr-0 max-w-0 opacity-0",
        )}
      >
        <FaCheck className="size-3.5" />
      </span>
      <span className="inline-flex items-center justify-center">{props.icon}</span>
    </span>
  );
}

export function MediaLibraryDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaLibraryItem[];
  mediaLoading: boolean;
  pickedMediaId: string | null;
  onPickedMediaIdChange: (id: string | null) => void;
  onConfirmSelection: (id: string) => void;
  confirmLabel?: string;
}) {
  const [viewMode, setViewMode] = useState<MediaViewMode>("thumbnail");
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const previewHostRef = useRef<HTMLDivElement | null>(null);

  function clearPreviewTimer() {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }

  function handleSelect(id: string) {
    props.onPickedMediaIdChange(id);
  }

  function handleConfirm(id: string) {
    handleSelect(id);
    props.onConfirmSelection(id);
  }

  function handleOpenChange(open: boolean) {
    clearPreviewTimer();
    setHoverPreview(null);
    if (!open) {
      setViewMode("thumbnail");
    }
    props.onOpenChange(open);
  }

  function scheduleHoverPreview(item: MediaLibraryItem, anchorEl: HTMLElement) {
    const hostEl = previewHostRef.current;
    if (!hostEl) return;

    clearPreviewTimer();
    const nextPosition = clampPreviewPosition({
      hostRect: hostEl.getBoundingClientRect(),
      anchorRect: anchorEl.getBoundingClientRect(),
    });
    previewTimerRef.current = window.setTimeout(() => {
      setHoverPreview({ media: item, ...nextPosition });
      previewTimerRef.current = null;
    }, PREVIEW_DELAY_MS);
  }

  function hideHoverPreview() {
    clearPreviewTimer();
    setHoverPreview(null);
  }

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[calc(100%-1rem)] p-4 sm:max-w-4xl sm:p-6" showCloseButton>
        <DialogHeader className="gap-3">
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle>Biblioteca de mídia</DialogTitle>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => {
                if (value === "thumbnail" || value === "list") {
                  setViewMode(value);
                  hideHoverPreview();
                }
              }}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="Alternar visualização da biblioteca"
            >
              <ToggleGroupItem value="list" aria-label="Lista" title="Lista">
                <ViewModeIcon active={viewMode === "list"} icon={<IoList className="size-[18px]" />} />
                <span className="sr-only">Lista</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="thumbnail" aria-label="Miniaturas" title="Miniaturas">
                <ViewModeIcon active={viewMode === "thumbnail"} icon={<HiOutlineSquares2X2 className="size-[18px]" />} />
                <span className="sr-only">Miniaturas</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </DialogHeader>

        <div ref={previewHostRef} className="relative">
        {viewMode === "thumbnail" ? (
          <ScrollArea className="h-[60vh] pr-4">
            {props.mediaLoading ? (
              <p className="text-muted-foreground py-4 text-sm">Carregando...</p>
            ) : props.media.length === 0 ? (
              <p className="text-muted-foreground py-4 text-sm">
                Nenhuma mídia disponível. Envie arquivos em Mídia.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-3 lg:grid-cols-4">
                {props.media.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "border-border relative aspect-square overflow-hidden rounded-lg border-2 transition-colors",
                      props.pickedMediaId === item.id && "border-primary ring-2 ring-primary/30",
                    )}
                    onClick={() => handleSelect(item.id)}
                    onDoubleClick={() => handleConfirm(item.id)}
                    >
                      <img src={item.url} alt={item.fileName ?? "mídia"} className="h-full w-full object-cover" />
                    </button>
                ))}
              </div>
            )}
          </ScrollArea>
        ) : (
          <ScrollArea className="h-[60vh] rounded-lg border">
            {props.mediaLoading ? (
              <p className="text-muted-foreground px-4 py-4 text-sm">Carregando...</p>
            ) : props.media.length === 0 ? (
              <p className="text-muted-foreground px-4 py-4 text-sm">
                Nenhuma mídia disponível. Envie arquivos em Mídia.
              </p>
            ) : (
              <div className="p-2">
                {props.media.map((item) => {
                  const selected = props.pickedMediaId === item.id;
                  const createdAt = formatMediaDate(item.createdAt);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md border-2 border-transparent px-3 py-2 text-left transition-colors hover:bg-accent/70",
                        selected && "border-primary bg-accent/40 ring-2 ring-primary/30",
                      )}
                      onBlur={hideHoverPreview}
                      onClick={() => handleSelect(item.id)}
                      onDoubleClick={() => handleConfirm(item.id)}
                    >
                      <div
                        className="bg-muted h-12 w-12 shrink-0 overflow-hidden rounded-md"
                        onMouseEnter={(event) => scheduleHoverPreview(item, event.currentTarget)}
                        onMouseLeave={hideHoverPreview}
                      >
                        <img src={item.url} alt={item.fileName ?? "mídia"} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {item.fileName ?? "Imagem sem nome"}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {createdAt ? `Adicionada em ${createdAt}` : "Data indisponível"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}

        {hoverPreview ? (
          <div
            className="pointer-events-none absolute z-20 h-[280px] w-[220px] overflow-hidden rounded-xl border bg-background shadow-2xl transition-opacity duration-200"
            style={{ left: hoverPreview.x, top: hoverPreview.y }}
          >
            <img
              src={hoverPreview.media.url}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => props.pickedMediaId && handleConfirm(props.pickedMediaId)} disabled={!props.pickedMediaId}>
            {props.confirmLabel ?? "Abrir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

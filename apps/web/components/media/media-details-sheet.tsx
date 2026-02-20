"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Copy, TrashIcon, ExternalLink } from "lucide-react";
import { formatFileSize } from "@/lib/file-utils";
import { formatDateAndTime } from "@/lib/datetime";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/hooks/use-media-library";
import { FaImage, FaVideo } from "react-icons/fa";

type MediaDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MediaItem | null;
  onRequestView?: (item: MediaItem) => void;
  onRequestRename?: (item: MediaItem) => void;
  onRequestDelete?: (id: string, fileName: string | null) => void;
};

function getContentTypeLabel(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
    "image/heic": "HEIC",
    "image/heif": "HEIF",
    "video/mp4": "MP4",
    "video/webm": "WEBM",
    "video/quicktime": "QuickTime",
  };
  return map[contentType] ?? contentType.split("/")[1]?.toUpperCase() ?? "Desconhecido";
}

function isImageType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

function isVideoType(contentType: string): boolean {
  return contentType.startsWith("video/");
}

export function MediaDetailsSheet({
  open,
  onOpenChange,
  item,
  onRequestView,
  onRequestRename,
  onRequestDelete,
}: MediaDetailsSheetProps) {
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  if (!item) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(item.url);
      toast.success("URL copiada para a área de transferência.");
    } catch {
      toast.error("Falha ao copiar URL.");
    }
  };

  const handleCopyFileName = async () => {
    if (!item.fileName) return;
    try {
      await navigator.clipboard.writeText(item.fileName);
      toast.success("Nome do arquivo copiado.");
    } catch {
      toast.error("Falha ao copiar nome.");
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="text-lg">Detalhes da mídia</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col">
          {/* Preview */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-lg overflow-hidden min-h-[300px] max-h-[400px]">
              {isImageType(item.contentType) ? (
                <img
                  src={item.url}
                  alt={item.fileName ?? "Mídia"}
                  className="max-w-full max-h-full object-contain"
                  onLoad={handleImageLoad}
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    el.style.display = "none";
                  }}
                />
              ) : isVideoType(item.contentType) ? (
                <video
                  src={item.url}
                  className="max-w-full max-h-full"
                  controls
                  preload="metadata"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 p-8">
                  <FaImage className="size-12 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Preview não disponível</p>
                </div>
              )}
            </div>
          </div>

          {/* Informações */}
          <div className="p-4 space-y-4">
            <div>
              <h3 className="mb-3 text-sm font-semibold">Informações</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-muted-foreground text-xs font-medium">Nome do arquivo</label>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="flex-1 truncate text-sm font-medium">{item.fileName ?? item.id}</p>
                    {item.fileName && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        onClick={handleCopyFileName}
                        aria-label="Copiar nome do arquivo"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-muted-foreground text-xs font-medium">Tipo</label>
                  <div className="mt-1">
                    <Badge variant="outline">{getContentTypeLabel(item.contentType)}</Badge>
                  </div>
                </div>

                <div>
                  <label className="text-muted-foreground text-xs font-medium">Tamanho</label>
                  <p className="mt-1 text-sm font-medium">{formatFileSize(item.sizeBytes)}</p>
                </div>

                {imageDimensions && (
                  <div>
                    <label className="text-muted-foreground text-xs font-medium">Dimensões</label>
                    <p className="mt-1 text-sm font-medium">
                      {imageDimensions.width} × {imageDimensions.height} px
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-muted-foreground text-xs font-medium">Data de upload</label>
                  <p className="mt-1 text-sm font-medium">{formatDateAndTime(item.createdAt)}</p>
                </div>

                <div>
                  <label className="text-muted-foreground text-xs font-medium">URL</label>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="flex-1 truncate font-mono text-xs break-all">{item.url}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={handleCopyUrl}
                      aria-label="Copiar URL"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={() => window.open(item.url, "_blank")}
                      aria-label="Abrir URL em nova aba"
                    >
                      <ExternalLink className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="border-t pt-4">
              <h3 className="mb-3 text-sm font-semibold">Ações</h3>
              <div className="flex flex-wrap gap-2">
                {onRequestView && (
                  <Button variant="outline" size="sm" onClick={() => onRequestView(item)}>
                    <Eye className="mr-2 size-4" />
                    Visualizar
                  </Button>
                )}
                {onRequestRename && (
                  <Button variant="outline" size="sm" onClick={() => onRequestRename(item)}>
                    <Pencil className="mr-2 size-4" />
                    Renomear
                  </Button>
                )}
                {onRequestDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onRequestDelete(item.id, item.fileName)}
                  >
                    <TrashIcon className="mr-2 size-4" />
                    Excluir
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

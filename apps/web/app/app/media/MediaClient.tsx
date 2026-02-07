"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useMediaLibrary, type MediaItem } from "@/hooks/use-media-library";

export function MediaUploadAction(props: { initialItems?: MediaItem[] }) {
  const media = useMediaLibrary({ initialItems: props.initialItems });
  const inputId = useId();

  return (
    <div className="flex items-center gap-3">
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

function MediaGrid(props: {
  items: MediaItem[];
  onDelete(id: string): void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {props.items.map((m) => (
        <Card key={m.id} className="overflow-hidden">
          <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900">
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
            <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-zinc-600 dark:text-zinc-300">
              <span className="pointer-events-none select-none">
                Se a imagem não aparecer, seu navegador pode não suportar esse formato.
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 p-2">
            <div className="min-w-0">
              <div className="truncate text-xs">{m.fileName ?? m.id}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => props.onDelete(m.id)}>
              Deletar
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function MediaClient(props: { initialItems?: MediaItem[] }) {
  const media = useMediaLibrary({ initialItems: props.initialItems });

  return (
    <div className="space-y-4">
      {media.error && <p className="text-destructive text-sm">{media.error}</p>}

      {media.isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : media.items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Sua biblioteca está vazia</EmptyTitle>
            <EmptyDescription>Envie a primeira imagem para usar em posts.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <MediaGrid items={media.items} onDelete={media.deleteItem} />
      )}
    </div>
  );
}


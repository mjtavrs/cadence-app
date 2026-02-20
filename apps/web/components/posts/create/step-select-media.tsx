"use client";

import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";

export type MediaItem = {
  id: string;
  url: string;
  fileName: string | null;
  createdAt: string;
};

export function StepSelectMedia(props: {
  media: MediaItem[];
  mediaLoading: boolean;
  selectedMediaId: string | null;
  onSelectMedia: (id: string) => void;
  onUploadFile: (file: File) => void;
  uploadPending: boolean;
  libraryDialogOpen: boolean;
  onLibraryDialogOpenChange: (open: boolean) => void;
  pickedMediaId: string | null;
  onPickedMediaIdChange: (id: string | null) => void;
  onConfirmLibraryPick: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = props.media.find((m) => m.id === props.selectedMediaId) ?? null;

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    props.onUploadFile(file);
  }

  function openLibraryDialog() {
    props.onPickedMediaIdChange(props.selectedMediaId);
    props.onLibraryDialogOpenChange(true);
  }

  return (
    <div className="flex flex-col items-center p-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        onChange={onFileSelected}
      />

      <div
        className="bg-muted relative w-full shrink-0 overflow-hidden rounded-md"
        style={{ aspectRatio: "1 / 1", maxWidth: 700 }}
      >
        {props.uploadPending ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/80">
            <Spinner className="size-8 text-primary" />
            <span className="text-muted-foreground text-sm">Enviando...</span>
          </div>
        ) : selected ? (
          <img
            src={selected.url}
            alt={selected.fileName ?? "Mídia selecionada"}
            className="h-full w-full object-cover"
          />
        ) : (
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted/50 flex h-full w-full cursor-pointer items-center justify-center rounded-none text-center text-sm transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            Escolha uma foto do seu dispositivo
          </button>
        )}
      </div>

      <div className="mt-3 w-full" style={{ maxWidth: 700 }}>
        <Button variant="default" size="sm" className="w-full" onClick={openLibraryDialog}>
          Ou escolha da sua biblioteca
        </Button>
      </div>

      <Dialog open={props.libraryDialogOpen} onOpenChange={props.onLibraryDialogOpenChange}>
        <DialogContent className="sm:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>Biblioteca de mídia</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            {props.mediaLoading ? (
              <p className="text-muted-foreground py-4 text-sm">Carregando...</p>
            ) : props.media.length === 0 ? (
              <p className="text-muted-foreground py-4 text-sm">Nenhuma mídia disponível. Envie arquivos em Mídia.</p>
            ) : (
              <div className="grid grid-cols-4 gap-3 py-2">
                {props.media.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                      props.pickedMediaId === m.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-muted-foreground/50"
                    }`}
                    onClick={() => props.onPickedMediaIdChange(m.id)}
                    title={m.fileName ?? m.id}
                  >
                    <img src={m.url} alt={m.fileName ?? "mídia"} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => props.onLibraryDialogOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={props.onConfirmLibraryPick} disabled={!props.pickedMediaId}>
              Abrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

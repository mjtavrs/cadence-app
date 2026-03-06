"use client";

import { useRef } from "react";
import { toast } from "sonner";

import { MediaLibraryDialog } from "@/components/posts/media-library-dialog";
import { Button } from "@/components/ui/button";
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

  function confirmLibraryPick(id: string) {
    props.onSelectMedia(id);
    props.onConfirmLibraryPick();
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
            alt={selected.fileName ?? "Midia selecionada"}
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

      <MediaLibraryDialog
        open={props.libraryDialogOpen}
        onOpenChange={props.onLibraryDialogOpenChange}
        media={props.media}
        mediaLoading={props.mediaLoading}
        pickedMediaId={props.pickedMediaId}
        onPickedMediaIdChange={props.onPickedMediaIdChange}
        onConfirmSelection={confirmLibraryPick}
        confirmLabel="Abrir"
      />
    </div>
  );
}

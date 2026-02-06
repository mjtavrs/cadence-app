"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

type MediaItem = {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  fileName: string | null;
  createdAt: string;
};

type MediaListResponse = {
  items: MediaItem[];
};

type PresignResponse = {
  mediaId: string;
  s3Key: string;
  uploadUrl: string;
};

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const maxBytes = 10 * 1024 * 1024;

async function loadMedia() {
  const res = await fetch("/api/media", { cache: "no-store" });
  const payload = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao carregar mídias.");
  const data = payload as MediaListResponse;
  return data.items ?? [];
}

export function MediaClient(props: { initialItems?: MediaItem[] }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);

  const mediaQuery = useQuery({
    queryKey: ["media"],
    queryFn: loadMedia,
    initialData: props.initialItems,
    staleTime: 30_000,
  });

  const items = mediaQuery.data ?? [];
  const canUpload = useMemo(() => items.length < 30, [items.length]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const presignRes = await fetch("/api/media/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          fileName: file.name,
          sizeBytes: file.size,
        }),
      });

      const presignPayload = (await presignRes.json().catch(() => null)) as unknown;
      if (!presignRes.ok) {
        throw new Error(getErrorMessage(presignPayload) ?? "Falha ao preparar upload.");
      }

      const presign = presignPayload as PresignResponse;

      const uploadRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Falha no upload para o S3.");
      }

      const createRes = await fetch("/api/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mediaId: presign.mediaId,
          s3Key: presign.s3Key,
          contentType: file.type,
          sizeBytes: file.size,
          fileName: file.name,
        }),
      });

      const createPayload = (await createRes.json().catch(() => null)) as unknown;
      if (!createRes.ok) {
        throw new Error(getErrorMessage(createPayload) ?? "Falha ao registrar mídia.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["media"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/media/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao deletar mídia.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["media"] });
    },
  });

  async function onPickFile(file: File) {
    setError(null);

    if (!allowedTypes.has(file.type)) {
      setError("Formato não suportado. Use JPEG, PNG, WEBP ou HEIC.");
      return;
    }
    if (file.size > maxBytes) {
      setError("Arquivo excede 10MB.");
      return;
    }
    if (!canUpload) {
      setError("Limite de 30 imagens atingido para este workspace.");
      return;
    }

    try {
      await uploadMutation.mutateAsync(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar imagem.");
    }
  }

  async function deleteItem(id: string) {
    setError(null);
    try {
      await deleteMutation.mutateAsync(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao deletar mídia.");
    }
  }

  const isBusy = mediaQuery.isFetching || uploadMutation.isPending || deleteMutation.isPending;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Biblioteca de mídia</h1>
          <p className="text-muted-foreground text-sm">
            Até 30 imagens por workspace. Máximo de 10MB por arquivo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void onPickFile(file);
              e.target.value = "";
            }}
          />
          <Button disabled={isBusy || !canUpload} onClick={() => inputRef.current?.click()}>
            {uploadMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Spinner className="h-4 w-4" />
                Enviando...
              </span>
            ) : (
              "Enviar imagem"
            )}
          </Button>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {mediaQuery.isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Sua biblioteca está vazia</EmptyTitle>
            <EmptyDescription>Envie a primeira imagem para usar em posts.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button disabled={isBusy || !canUpload} onClick={() => inputRef.current?.click()}>
              Enviar imagem
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900">
                {/* `next/image` não é ideal aqui: URLs assinadas expiram e a otimização pode cachear/invalidar. */}
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
                <Button variant="ghost" size="sm" onClick={() => deleteItem(m.id)}>
                  Deletar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


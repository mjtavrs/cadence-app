"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type MediaItem = {
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

export function useMediaLibrary(opts?: { initialItems?: MediaItem[] }) {
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);

  const mediaQuery = useQuery({
    queryKey: ["media"],
    queryFn: loadMedia,
    initialData: opts?.initialItems,
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

  return {
    items,
    error,
    setError,
    canUpload,
    isBusy,
    isLoading: mediaQuery.isLoading,
    isFetching: mediaQuery.isFetching,
    uploadPending: uploadMutation.isPending,
    onPickFile,
    deleteItem,
  } as const;
}


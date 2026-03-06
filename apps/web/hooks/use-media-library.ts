"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type UploadProgress = {
  fileId: string;
  fileName: string;
  status: "pending" | "uploading" | "success" | "error" | "cancelled";
  progress: number;
  error?: string;
  abortController?: AbortController;
};

export type MediaItem = {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  fileName: string | null;
  folderId?: string | null;
  createdAt: string;
};

export type MediaFolder = {
  id: string;
  name: string;
  parentFolderId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type MediaListResponse = {
  items: MediaItem[];
};

type FolderListResponse = {
  items: MediaFolder[];
};

type PresignResponse = {
  mediaId: string;
  s3Key: string;
  uploadUrl: string;
};

type PresignBatchResponse = {
  presigns: Array<{
    index: number;
    mediaId: string;
    s3Key: string;
    uploadUrl: string;
  }>;
  errors?: Array<{
    index: number;
    message: string;
  }>;
};

type CreateBatchResponse = {
  created: Array<{ mediaId: string }>;
  errors?: Array<{
    mediaId: string;
    message: string;
  }>;
};

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const maxBytes = 10 * 1024 * 1024;

function uploadFileWithProgress(
  url: string,
  file: File,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
): Promise<{ ok: boolean; status: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener("load", () => {
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Erro de rede ao fazer upload."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelado."));
    });

    signal.addEventListener("abort", () => {
      xhr.abort();
    });

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

async function loadMedia() {
  const res = await fetch("/api/media", { cache: "no-store" });
  const payload = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao carregar mÃ­dias.");
  const data = payload as MediaListResponse;
  return data.items ?? [];
}
async function loadFolders() {
  const res = await fetch("/api/media/folders", { cache: "no-store" });
  const payload = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao carregar pastas.");
  const data = payload as FolderListResponse;
  return data.items ?? [];
}

export function useMediaLibrary(opts?: { initialItems?: MediaItem[] }) {
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  async function refreshMediaQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["media"] }),
      queryClient.invalidateQueries({ queryKey: ["media-storage-summary"] }),
    ]);
  }

  async function refreshFolderQueries() {
    await queryClient.invalidateQueries({ queryKey: ["media-folders"] });
  }

  const mediaQuery = useQuery({
    queryKey: ["media"],
    queryFn: loadMedia,
    initialData: opts?.initialItems,
    staleTime: 30_000,
  });

  const foldersQuery = useQuery({
    queryKey: ["media-folders"],
    queryFn: loadFolders,
    staleTime: 30_000,
  });

  const items = mediaQuery.data ?? [];
  const folders = foldersQuery.data ?? [];
  const canUpload = useMemo(() => items.length < 30, [items.length]);

  const uploadMutation = useMutation({
    mutationFn: async (params: { file: File; folderId?: string | null }) => {
      const file = params.file;
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
          folderId: params.folderId ?? null,
        }),
      });

      const createPayload = (await createRes.json().catch(() => null)) as unknown;
      if (!createRes.ok) {
        throw new Error(getErrorMessage(createPayload) ?? "Falha ao registrar mÃ­dia.");
      }
    },
    onSuccess: async () => {
      await refreshMediaQueries();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/media/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao deletar mÃ­dia.");
    },
    onSuccess: async (_data, id) => {
      await refreshMediaQueries();
      toast.success("MÃ­dia excluÃ­da.");
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    onError: () => {
      // noop: estado Ã© limpo no onSettled
    },
    onSettled: (_data, _error, id) => {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/media/batch/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: ids }),
      });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao excluir mÃ­dias.");
      const data = payload as { deleted?: string[] };
      return data.deleted ?? [];
    },
    onSuccess: async (deleted) => {
      await refreshMediaQueries();
      const n = deleted.length;
      toast.success(n === 1 ? "MÃ­dia excluÃ­da." : `${n} mÃ­dias excluÃ­das.`);
    },
  });

  const moveBatchMutation = useMutation({
    mutationFn: async (params: { mediaIds: string[]; folderId?: string | null }) => {
      const res = await fetch("/api/media/batch/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: params.mediaIds, folderId: params.folderId ?? null }),
      });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao mover mídias.");
      const data = payload as { moved?: string[] };
      return data.moved ?? [];
    },
    onSuccess: async (moved) => {
      await refreshMediaQueries();
      const n = moved.length;
      toast.success(n === 1 ? "Mídia movida." : `${n} mídias movidas.`);
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, fileName }: { id: string; fileName: string }) => {
      const res = await fetch(`/api/media/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      if (res.status === 501) throw new Error("UNAVAILABLE");
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao renomear.");
    },
    onSuccess: async () => {
      await refreshMediaQueries();
      toast.success("Arquivo renomeado.");
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (params: { name: string; parentFolderId?: string | null }) => {
      const res = await fetch("/api/media/folders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: params.name,
          parentFolderId: params.parentFolderId ?? null,
        }),
      });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao criar pasta.");
      return payload as MediaFolder;
    },
    onSuccess: async () => {
      await refreshFolderQueries();
      toast.success("Pasta criada.");
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/media/folders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao renomear pasta.");
    },
    onSuccess: async () => {
      await refreshFolderQueries();
      toast.success("Pasta renomeada.");
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/media/folders/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao excluir pasta.");
    },
    onSuccess: async () => {
      await Promise.all([refreshFolderQueries(), refreshMediaQueries()]);
      toast.success("Pasta excluida.");
    },
  });

  async function onPickFile(file: File, options?: { folderId?: string | null }) {
    setError(null);

    if (!allowedTypes.has(file.type)) {
      setError("Formato nÃ£o suportado. Use JPEG, PNG, WEBP ou HEIC.");
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
      await uploadMutation.mutateAsync({
        file,
        folderId: options?.folderId ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar imagem.");
    }
  }

  async function onPickFiles(files: File[], options?: { folderId?: string | null }) {
    setError(null);
    const progressMap = new Map<string, UploadProgress>();

    const validFiles: Array<{ file: File; index: number; fileId: string }> = [];
    const errors: Array<{ index: number; fileName: string; message: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 9)}`;

      progressMap.set(fileId, {
        fileId,
        fileName: file.name,
        status: "pending",
        progress: 0,
      });

      if (!allowedTypes.has(file.type)) {
        errors.push({ index: i, fileName: file.name, message: "Formato nÃ£o suportado." });
        progressMap.set(fileId, {
          fileId,
          fileName: file.name,
          status: "error",
          progress: 0,
          error: "Formato nÃ£o suportado.",
        });
        continue;
      }
      if (file.size > maxBytes) {
        errors.push({ index: i, fileName: file.name, message: "Arquivo excede 10MB." });
        progressMap.set(fileId, {
          fileId,
          fileName: file.name,
          status: "error",
          progress: 0,
          error: "Arquivo excede 10MB.",
        });
        continue;
      }

      validFiles.push({ file, index: i, fileId });
    }

    setUploadProgress(new Map(progressMap));

    if (validFiles.length === 0) {
      const errorMessages = errors.map((e) => `${e.fileName}: ${e.message}`).join("\n");
      setError(`Nenhum arquivo vÃ¡lido.\n${errorMessages}`);
      return;
    }

    const availableSlots = 30 - items.length;
    if (validFiles.length > availableSlots) {
      setError(
        `Limite de 30 imagens atingido. VocÃª pode fazer upload de ${availableSlots} arquivo(s).`,
      );
      for (const { fileId } of validFiles) {
        progressMap.set(fileId, {
          fileId,
          fileName: progressMap.get(fileId)?.fileName ?? "",
          status: "error",
          progress: 0,
          error: "Limite excedido.",
        });
      }
      setUploadProgress(new Map(progressMap));
      return;
    }

    try {
      const presignRes = await fetch("/api/media/presign/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: validFiles.map(({ file }) => ({
            contentType: file.type,
            fileName: file.name,
            sizeBytes: file.size,
          })),
        }),
      });

      const presignPayload = (await presignRes.json().catch(() => null)) as unknown;
      if (!presignRes.ok) {
        const errorMsg = getErrorMessage(presignPayload) ?? "Falha ao preparar upload.";
        setError(errorMsg);
        for (const { fileId } of validFiles) {
            progressMap.set(fileId, {
              fileId,
              fileName: progressMap.get(fileId)?.fileName ?? "",
              status: "error",
              progress: 0,
              error: errorMsg,
            });
        }
        setUploadProgress(new Map(progressMap));
        return;
      }

      const presignData = presignPayload as PresignBatchResponse;

      if (presignData.errors && presignData.errors.length > 0) {
        for (const err of presignData.errors) {
          const validFile = validFiles.find((f) => f.index === err.index);
          if (validFile) {
            progressMap.set(validFile.fileId, {
              fileId: validFile.fileId,
              fileName: validFile.file.name,
              status: "error",
              progress: 0,
              error: err.message,
            });
          }
        }
      }

      const uploadPromises = presignData.presigns.map(async (presign) => {
        const validFile = validFiles.find((f) => f.index === presign.index);
        if (!validFile) return null;

        const fileId = validFile.fileId;
        const abortController = new AbortController();
        abortControllersRef.current.set(fileId, abortController);

        progressMap.set(fileId, {
          fileId,
          fileName: validFile.file.name,
          status: "uploading",
          progress: 0,
          abortController,
        });
        setUploadProgress(new Map(progressMap));

        try {
          const uploadResult = await uploadFileWithProgress(
            presign.uploadUrl,
            validFile.file,
            abortController.signal,
            (progress) => {
              progressMap.set(fileId, {
                fileId,
                fileName: validFile.file.name,
                status: "uploading",
                progress,
                abortController,
              });
              setUploadProgress(new Map(progressMap));
            },
          );

          if (!uploadResult.ok) {
            throw new Error("Falha no upload para o S3.");
          }

          abortControllersRef.current.delete(fileId);
          progressMap.set(fileId, {
            fileId,
            fileName: validFile.file.name,
            status: "success",
            progress: 100,
          });
          setUploadProgress(new Map(progressMap));

          return {
            mediaId: presign.mediaId,
            s3Key: presign.s3Key,
            contentType: validFile.file.type,
            sizeBytes: validFile.file.size,
            fileName: validFile.file.name,
          };
        } catch (e) {
          abortControllersRef.current.delete(fileId);
          if (e instanceof Error && e.name === "AbortError") {
            progressMap.set(fileId, {
              fileId,
              fileName: validFile.file.name,
              status: "cancelled",
              progress: progressMap.get(fileId)?.progress ?? 0,
            });
          } else {
            progressMap.set(fileId, {
              fileId,
              fileName: validFile.file.name,
              status: "error",
              progress: progressMap.get(fileId)?.progress ?? 0,
              error: e instanceof Error ? e.message : "Falha no upload.",
            });
          }
          setUploadProgress(new Map(progressMap));
          return null;
        }
      });

      const uploadResults = await Promise.all(uploadPromises);
      const successfulUploads = uploadResults.filter(
        (r): r is NonNullable<typeof r> => r !== null,
      );

      if (successfulUploads.length === 0) {
        setError("Nenhum arquivo foi enviado com sucesso.");
        return;
      }

      const createRes = await fetch("/api/media/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          folderId: options?.folderId ?? null,
          items: successfulUploads,
        }),
      });

      const createPayload = (await createRes.json().catch(() => null)) as unknown;
      if (!createRes.ok) {
        const errorMsg = getErrorMessage(createPayload) ?? "Falha ao registrar mÃ­dia.";
        setError(errorMsg);
        return;
      }

      const createData = createPayload as CreateBatchResponse;

      if (createData.errors && createData.errors.length > 0) {
        const errorMessages = createData.errors.map((e) => e.message).join("\n");
        toast.error(`Alguns arquivos falharam ao serem registrados:\n${errorMessages}`);
      }

      await refreshMediaQueries();
      await queryClient.refetchQueries({ queryKey: ["media"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar arquivos.");
      for (const { fileId } of validFiles) {
        const current = progressMap.get(fileId);
        if (current && current.status !== "success") {
          progressMap.set(fileId, {
            ...current,
            status: "error",
            progress: current.progress ?? 0,
            error: "Erro no processamento.",
          });
        }
      }
      setUploadProgress(new Map(progressMap));
    }
  }

  async function deleteItem(id: string) {
    setError(null);
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      await deleteMutation.mutateAsync(id);
    } catch (e) {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setError(e instanceof Error ? e.message : "Falha ao deletar mÃ­dia.");
    }
  }

  async function deleteBatch(ids: string[]) {
    if (ids.length === 0) return;
    setError(null);
    try {
      await deleteBatchMutation.mutateAsync(ids);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao excluir mÃ­dias.");
    }
  }

  async function moveItemsToFolder(ids: string[], folderId: string | null) {
    if (ids.length === 0) return;
    setError(null);
    try {
      await moveBatchMutation.mutateAsync({ mediaIds: ids, folderId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao mover mídias.");
      throw e;
    }
  }

  async function renameItem(id: string, fileName: string) {
    setError(null);
    try {
      await renameMutation.mutateAsync({ id, fileName });
    } catch (e) {
      if (e instanceof Error && e.message === "UNAVAILABLE") {
        toast.info("Renomear estarÃ¡ disponÃ­vel em breve.");
        return;
      }
      setError(e instanceof Error ? e.message : "Falha ao renomear.");
    }
  }

  async function createFolder(name: string, parentFolderId?: string | null) {
    setError(null);
    try {
      const payload = await createFolderMutation.mutateAsync({
        name,
        parentFolderId: parentFolderId ?? null,
      });
      return payload;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao criar pasta.";
      setError(message);
      throw e;
    }
  }

  async function renameFolder(id: string, name: string) {
    setError(null);
    try {
      await renameFolderMutation.mutateAsync({ id, name });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao renomear pasta.";
      setError(message);
      throw e;
    }
  }

  async function deleteFolder(id: string) {
    setError(null);
    try {
      await deleteFolderMutation.mutateAsync(id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao excluir pasta.";
      setError(message);
      throw e;
    }
  }

  function cancelUpload(fileId: string) {
    const controller = abortControllersRef.current.get(fileId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(fileId);
    }

    setUploadProgress((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(fileId);
      if (current) {
        newMap.set(fileId, {
          ...current,
          status: "cancelled",
        });
      }
      return newMap;
    });

    setTimeout(() => {
      setUploadProgress((prev) => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
    }, 2000);
  }

  const isBusy =
    mediaQuery.isFetching ||
    foldersQuery.isFetching ||
    uploadMutation.isPending ||
    deleteMutation.isPending ||
    deleteBatchMutation.isPending ||
    moveBatchMutation.isPending ||
    renameMutation.isPending ||
    createFolderMutation.isPending ||
    renameFolderMutation.isPending ||
    deleteFolderMutation.isPending;

  return {
    items,
    folders,
    error,
    setError,
    canUpload,
    isBusy,
    isLoading: mediaQuery.isLoading,
    isFetching: mediaQuery.isFetching,
    isLoadingFolders: foldersQuery.isLoading,
    isFetchingFolders: foldersQuery.isFetching,
    uploadPending: uploadMutation.isPending,
    deletingIds,
    uploadProgress: Array.from(uploadProgress.values()),
    isDeletingBatch: deleteBatchMutation.isPending,
    isCreatingFolder: createFolderMutation.isPending,
    isRenamingFolder: renameFolderMutation.isPending,
    isDeletingFolder: deleteFolderMutation.isPending,
    onPickFile,
    onPickFiles,
    cancelUpload,
    deleteItem,
    deleteBatch,
    moveItemsToFolder,
    renameItem,
    createFolder,
    renameFolder,
    deleteFolder,
  } as const;
}


"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type UploadProgress = {
  fileId: string;
  fileName: string;
  status: "pending" | "uploading" | "success" | "replaced" | "error" | "cancelled";
  progress: number;
  error?: string;
  abortController?: AbortController;
};

export type UploadBatchResult = {
  uploaded: number;
  replaced: number;
  failed: number;
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

type ResolveFolderTreeResponse = {
  items: Array<{
    path: string;
    folderId: string;
  }>;
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
  replacedMediaIds?: string[];
  errors?: Array<{
    mediaId: string;
    message: string;
  }>;
};

type UploadOptions = {
  folderId?: string | null;
  dedupeMode?: "replace_by_name_ext";
  getFolderId?: (file: File, index: number) => string | null;
};

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const maxBytes = 10 * 1024 * 1024;
const MAX_ITEMS_PER_WORKSPACE = 150;
const MAX_BATCH_UPLOAD_SIZE = 25;

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
  if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao carregar mídias.");
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
  const canUpload = useMemo(() => items.length < MAX_ITEMS_PER_WORKSPACE, [items.length]);

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
        throw new Error(getErrorMessage(createPayload) ?? "Falha ao registrar mídia.");
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
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao deletar mídia.");
    },
    onSuccess: async (_data, id) => {
      await refreshMediaQueries();
      toast.success("Mídia excluída.");
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    onError: () => {
      // noop: estado é limpo no onSettled
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
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao excluir mídias.");
      const data = payload as { deleted?: string[] };
      return data.deleted ?? [];
    },
    onSuccess: async (deleted) => {
      await refreshMediaQueries();
      const n = deleted.length;
      toast.success(n === 1 ? "Mídia excluída." : `${n} mídias excluídas.`);
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
      toast.success("Pasta excluída.");
    },
  });

  async function onPickFile(file: File, options?: { folderId?: string | null }) {
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
      setError(`Limite de ${MAX_ITEMS_PER_WORKSPACE} imagens atingido para este workspace.`);
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

  async function onPickFiles(files: File[], options?: UploadOptions): Promise<UploadBatchResult | void> {
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
        errors.push({ index: i, fileName: file.name, message: "Formato não suportado." });
        progressMap.set(fileId, {
          fileId,
          fileName: file.name,
          status: "error",
          progress: 0,
          error: "Formato não suportado.",
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
      setError(`Nenhum arquivo válido.\n${errorMessages}`);
      return;
    }

    const availableSlots = Math.max(0, MAX_ITEMS_PER_WORKSPACE - items.length);
    if (validFiles.length > availableSlots) {
      setError(
        `Limite de ${MAX_ITEMS_PER_WORKSPACE} imagens atingido. Você pode fazer upload de ${availableSlots} arquivo(s).`,
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
      let hadSuccessfulUpload = false;
      let uploadedCount = 0;
      let replacedCount = 0;
      const defaultFolderId = options?.folderId ?? null;
      const resolveFolderId = options?.getFolderId ?? (() => defaultFolderId);

      for (let start = 0; start < validFiles.length; start += MAX_BATCH_UPLOAD_SIZE) {
        const chunk = validFiles.slice(start, start + MAX_BATCH_UPLOAD_SIZE);

        const presignRes = await fetch("/api/media/presign/batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            files: chunk.map(({ file }) => ({
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
          for (const { fileId } of chunk) {
            progressMap.set(fileId, {
              fileId,
              fileName: progressMap.get(fileId)?.fileName ?? "",
              status: "error",
              progress: 0,
              error: errorMsg,
            });
          }
          setUploadProgress(new Map(progressMap));
          continue;
        }

        const presignData = presignPayload as PresignBatchResponse;
        const filesByChunkIndex = new Map(chunk.map((item, idx) => [idx, item] as const));

        if (presignData.errors && presignData.errors.length > 0) {
          for (const err of presignData.errors) {
            const validFile = filesByChunkIndex.get(err.index);
            if (!validFile) continue;
            progressMap.set(validFile.fileId, {
              fileId: validFile.fileId,
              fileName: validFile.file.name,
              status: "error",
              progress: 0,
              error: err.message,
            });
          }
          setUploadProgress(new Map(progressMap));
        }

        const uploadPromises = presignData.presigns.map(async (presign) => {
          const validFile = filesByChunkIndex.get(presign.index);
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
              fileId,
              mediaId: presign.mediaId,
              s3Key: presign.s3Key,
              contentType: validFile.file.type,
              sizeBytes: validFile.file.size,
              fileName: validFile.file.name,
              folderId: resolveFolderId(validFile.file, validFile.index),
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
        const successfulUploads = uploadResults.filter((r): r is NonNullable<typeof r> => r !== null);

        if (successfulUploads.length === 0) {
          continue;
        }
        hadSuccessfulUpload = true;

        const createRes = await fetch("/api/media/batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            folderId: defaultFolderId,
            dedupeMode: options?.dedupeMode,
            items: successfulUploads.map(({ fileId: _ignored, ...item }) => item),
          }),
        });

        const createPayload = (await createRes.json().catch(() => null)) as unknown;
        if (!createRes.ok) {
          const errorMsg = getErrorMessage(createPayload) ?? "Falha ao registrar mídia.";
          setError(errorMsg);
          for (const upload of successfulUploads) {
            progressMap.set(upload.fileId, {
              fileId: upload.fileId,
              fileName: upload.fileName,
              status: "error",
              progress: 100,
              error: errorMsg,
            });
          }
          setUploadProgress(new Map(progressMap));
          continue;
        }

        const createData = createPayload as CreateBatchResponse;
        uploadedCount += createData.created?.length ?? 0;
        const replacedSet = new Set(createData.replacedMediaIds ?? []);
        replacedCount += replacedSet.size;
        if (replacedSet.size > 0) {
          const uploadByMediaId = new Map(successfulUploads.map((item) => [item.mediaId, item] as const));
          for (const mediaId of replacedSet) {
            const replaced = uploadByMediaId.get(mediaId);
            if (!replaced) continue;
            progressMap.set(replaced.fileId, {
              fileId: replaced.fileId,
              fileName: replaced.fileName,
              status: "replaced",
              progress: 100,
            });
          }
          setUploadProgress(new Map(progressMap));
        }
        if (createData.errors && createData.errors.length > 0) {
          const uploadByMediaId = new Map(successfulUploads.map((item) => [item.mediaId, item] as const));
          for (const err of createData.errors) {
            const failed = uploadByMediaId.get(err.mediaId);
            if (!failed) continue;
            progressMap.set(failed.fileId, {
              fileId: failed.fileId,
              fileName: failed.fileName,
              status: "error",
              progress: 100,
              error: err.message,
            });
          }
          setUploadProgress(new Map(progressMap));
          const errorMessages = createData.errors.map((e) => e.message).join("\n");
          toast.error(`Alguns arquivos falharam ao serem registrados:\n${errorMessages}`);
        }
      }

      if (!hadSuccessfulUpload) {
        setError((prev) => prev ?? "Nenhum arquivo foi enviado com sucesso.");
        return;
      }

      await refreshMediaQueries();
      await queryClient.refetchQueries({ queryKey: ["media"] });
      const failedCount = Array.from(progressMap.values()).filter((item) => item.status === "error").length;
      return { uploaded: uploadedCount, replaced: replacedCount, failed: failedCount };
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
      return;
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
      setError(e instanceof Error ? e.message : "Falha ao deletar mídia.");
    }
  }

  async function deleteBatch(ids: string[]) {
    if (ids.length === 0) return;
    setError(null);
    try {
      await deleteBatchMutation.mutateAsync(ids);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao excluir mídias.");
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
        toast.info("Renomear estará disponível em breve.");
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

  async function resolveFolderTree(folders: string[], parentFolderId?: string | null) {
    setError(null);
    const res = await fetch("/api/media/folders/resolve-tree", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        folders,
        parentFolderId: parentFolderId ?? null,
      }),
    });
    const payload = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const message = getErrorMessage(payload) ?? "Falha ao resolver árvore de pastas.";
      setError(message);
      throw new Error(message);
    }
    const data = payload as ResolveFolderTreeResponse;
    const mapping = new Map<string, string>();
    for (const item of data.items ?? []) {
      if (typeof item.path === "string" && typeof item.folderId === "string") {
        mapping.set(item.path, item.folderId);
      }
    }
    return mapping;
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
    refetchMedia: mediaQuery.refetch,
    refetchFolders: foldersQuery.refetch,
    uploadPending: uploadMutation.isPending,
    deletingIds,
    uploadProgress: Array.from(uploadProgress.values()),
    isDeletingBatch: deleteBatchMutation.isPending,
    isCreatingFolder: createFolderMutation.isPending,
    isRenamingFolder: renameFolderMutation.isPending,
    isDeletingFolder: deleteFolderMutation.isPending,
    onPickFile,
    onPickFiles,
    resolveFolderTree,
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


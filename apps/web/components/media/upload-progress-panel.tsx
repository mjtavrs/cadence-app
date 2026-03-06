"use client";

import { X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { UploadProgress } from "@/hooks/use-media-library";

type UploadProgressPanelProps = {
  uploads: UploadProgress[];
  onCancel: (fileId: string) => void;
  onClose?: () => void;
  selectedCount?: number;
};

function getStatusIcon(status: UploadProgress["status"]) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />;
    case "error":
      return <AlertCircle className="size-4 text-destructive" />;
    case "uploading":
      return <Loader2 className="size-4 animate-spin text-primary" />;
    case "pending":
      return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
    case "cancelled":
      return <X className="size-4 text-muted-foreground" />;
    default:
      return null;
  }
}

function getStatusText(status: UploadProgress["status"]) {
  switch (status) {
    case "pending":
      return "Aguardando...";
    case "uploading":
      return "Enviando...";
    case "success":
      return "Concluído";
    case "error":
      return "Erro";
    case "cancelled":
      return "Cancelado";
    default:
      return "";
  }
}

function truncateFileName(fileName: string, maxLength = 30) {
  if (fileName.length <= maxLength) return fileName;
  const ext = fileName.slice(fileName.lastIndexOf("."));
  const name = fileName.slice(0, fileName.lastIndexOf("."));
  return `${name.slice(0, maxLength - ext.length - 3)}...${ext}`;
}

export function UploadProgressPanel({ uploads, onCancel, onClose, selectedCount = 0 }: UploadProgressPanelProps) {
  if (uploads.length === 0) {
    return null;
  }

  const activeUploads = uploads.filter((u) => u.status === "pending" || u.status === "uploading");
  const completedCount = uploads.filter((u) => u.status === "success").length;
  const errorCount = uploads.filter((u) => u.status === "error").length;
  const totalCount = uploads.length;

  const handleClose = () => {
    onClose?.();
  };

  return (
      <div
        className={cn(
          "fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background shadow-xl transition-all duration-300",
          "animate-in slide-in-from-bottom-4 fade-in-0",
        )}
        style={{ bottom: selectedCount > 0 ? "100px" : "16px" }}
      >
        <div className="border-b p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {activeUploads.length > 0
                ? `Enviando ${activeUploads.length} de ${totalCount} arquivo(s)`
                : errorCount > 0
                  ? `${completedCount} de ${totalCount} concluído(s), ${errorCount} erro(s)`
                  : `${completedCount} de ${totalCount} arquivo(s) enviado(s)`}
            </h3>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                onClick={handleClose}
                aria-label="Fechar painel"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

      <div className="max-h-96 overflow-y-auto p-2">
        <div className="space-y-2">
          {uploads.map((upload) => {
            const isActive = upload.status === "pending" || upload.status === "uploading";
            const showProgress = upload.status === "uploading";
            const canCancel = isActive && upload.status !== "cancelled";

            return (
              <div
                key={upload.fileId}
                className={cn(
                  "rounded-md border p-2 transition-all duration-200",
                  upload.status === "error" && "border-destructive/50 bg-destructive/5",
                  upload.status === "success" && "border-green-500/50 bg-green-500/5",
                  upload.status === "cancelled" && "opacity-60",
                  upload.status === "pending" && "border-muted bg-muted/30",
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">{getStatusIcon(upload.status)}</div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className="truncate text-sm font-medium"
                        title={upload.fileName}
                      >
                        {truncateFileName(upload.fileName)}
                      </p>
                      {canCancel && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0"
                          onClick={() => onCancel(upload.fileId)}
                          aria-label="Cancelar upload"
                        >
                          <X className="size-3" />
                        </Button>
                      )}
                    </div>

                    {showProgress && (
                      <div className="mt-2 space-y-1 animate-in fade-in-0 slide-in-from-top-1">
                        <Progress value={upload.progress} className="h-1.5 transition-all duration-300" />
                        <p className="text-muted-foreground text-xs font-medium">{upload.progress}%</p>
                      </div>
                    )}

                    {upload.status !== "uploading" && (
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          upload.status === "error" && "text-destructive",
                          upload.status === "success" && "text-green-600 dark:text-green-400",
                          upload.status === "cancelled" && "text-muted-foreground",
                        )}
                      >
                        {upload.error ?? getStatusText(upload.status)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

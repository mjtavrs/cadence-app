"use client";

import { useState } from "react";
import Link from "next/link";
import { CopyIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PostStatusBadge } from "@/components/posts/post-status-badge";
import { formatRecifeDateTimeShort } from "@/lib/datetime";

export type PostStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "FAILED";

export type PostListItem = {
  postId: string;
  status: PostStatus;
  title?: string;
  shortCode?: string;
  tags?: string[];
  caption: string;
  mediaIds: string[];
  scheduledAtUtc?: string;
};

export function PostCard(props: {
  item: PostListItem;
  isBusy: boolean;
  onSubmit(): void;
  onApprove(): void;
  onSchedule(): void;
  onCancel(): void;
  onDelete(): void;
}) {
  const p = props.item;
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function copyCode() {
    if (!p.shortCode) return;
    try {
      await navigator.clipboard.writeText(p.shortCode);
      toast.success("Código copiado.");
    } catch {
      toast.error("Não foi possível copiar o código.");
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <PostStatusBadge status={p.status} />
            {p.scheduledAtUtc && (
              <span className="text-muted-foreground text-xs">
                Agendado: {formatRecifeDateTimeShort(p.scheduledAtUtc)}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 truncate text-sm font-medium">
                {p.title?.trim() ? p.title : "Sem título"}
              </div>
              {p.shortCode ? (
                <Badge variant="outline" className="gap-1">
                  <span className="font-mono text-[11px]">{p.shortCode}</span>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={copyCode} aria-label="Copiar código">
                    <CopyIcon className="h-3 w-3" />
                  </Button>
                </Badge>
              ) : null}
            </div>

            {p.tags?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {p.tags.slice(0, 6).map((t) => (
                  <Badge key={t} variant="outline">
                    #{t}
                  </Badge>
                ))}
                {p.tags.length > 6 ? (
                  <span className="text-muted-foreground text-xs">+{p.tags.length - 6}</span>
                ) : null}
              </div>
            ) : null}
          </div>

          <p className="line-clamp-2 text-sm text-zinc-900 dark:text-zinc-50">{p.caption}</p>

          <div className="text-muted-foreground text-xs">
            {p.mediaIds?.length ? `mídia: ${p.mediaIds[0]}` : "sem mídia"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/app/posts/${encodeURIComponent(p.postId)}`}>Editar</Link>
          </Button>
          {p.status === "DRAFT" && (
            <Button size="sm" disabled={props.isBusy} onClick={props.onSubmit}>
              Enviar para review
            </Button>
          )}
          {p.status === "IN_REVIEW" && (
            <Button size="sm" disabled={props.isBusy} onClick={props.onApprove}>
              Aprovar
            </Button>
          )}
          {p.status === "APPROVED" && (
            <Button size="sm" disabled={props.isBusy} onClick={props.onSchedule}>
              Agendar
            </Button>
          )}
          {p.status === "SCHEDULED" && (
            <Button variant="secondary" size="sm" disabled={props.isBusy} onClick={props.onCancel}>
              Cancelar
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            disabled={props.isBusy}
            onClick={() => setDeleteOpen(true)}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar post</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este post? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false);
                props.onDelete();
              }}
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}


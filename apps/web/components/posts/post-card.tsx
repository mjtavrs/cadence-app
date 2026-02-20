"use client";

import { useState } from "react";
import Link from "next/link";
import { TrashIcon, Eye, Pencil, Copy } from "lucide-react";
import { toast } from "sonner";
import { SlOptionsVertical } from "react-icons/sl";
import { FaImage, FaVideo } from "react-icons/fa";
import { FaInstagram } from "react-icons/fa";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PostStatusBadge } from "@/components/posts/post-status-badge";
import { formatDateAndTime } from "@/lib/datetime";

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
  onPreview?(): void;
  onDuplicate?(): void;
  onCaptionMore?: () => void;
}) {
  const p = props.item;
  const [deleteOpen, setDeleteOpen] = useState(false);

  function getStatusAction() {
    switch (p.status) {
      case "DRAFT":
        return { label: "Enviar para review", action: props.onSubmit };
      case "IN_REVIEW":
        return { label: "Aprovar", action: props.onApprove };
      case "APPROVED":
        return { label: "Agendar", action: props.onSchedule };
      case "SCHEDULED":
        return { label: "Cancelar agendamento", action: props.onCancel };
      default:
        return null;
    }
  }

  const statusAction = getStatusAction();

  const isDraft = p.status === "DRAFT";

  return (
    <Card className={cn("p-4", isDraft && "border-dashed bg-muted/30")}>
      <div className="flex flex-col gap-4">
        {/* Topo: Título + Status + Data */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <h3 className="text-base font-medium">{p.title?.trim() || "Sem título"}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <PostStatusBadge status={p.status} />
              {p.scheduledAtUtc && (
                <span className="text-muted-foreground text-xs">
                  Agendado: {formatDateAndTime(p.scheduledAtUtc)}
                </span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" disabled={props.isBusy} aria-label="Opções">
                <SlOptionsVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {statusAction && (
                <DropdownMenuItem onClick={statusAction.action} disabled={props.isBusy}>
                  {statusAction.label}
                </DropdownMenuItem>
              )}
              {props.onPreview && (
                <DropdownMenuItem onClick={props.onPreview}>
                  <Eye className="mr-2 size-4" />
                  Preview
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href={`/app/posts/${encodeURIComponent(p.postId)}`}>
                  <Pencil className="mr-2 size-4" />
                  Editar
                </Link>
              </DropdownMenuItem>
              {props.onDuplicate && (
                <DropdownMenuItem onClick={props.onDuplicate}>
                  <Copy className="mr-2 size-4" />
                  Duplicar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)} disabled={props.isBusy}>
                <TrashIcon className="mr-2 size-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Corpo: Legenda + Tags + Ícone de mídia */}
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {p.caption.length > 100 ? (
              <>
                {p.caption.slice(0, 100)}
                <span className="text-muted-foreground">...</span>{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onCaptionMore?.();
                  }}
                >
                  mais
                </button>
              </>
            ) : (
              p.caption
            )}
          </div>
          {p.tags && p.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {p.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-xs">
                  #{t}
                </Badge>
              ))}
            </div>
          )}
          {p.mediaIds && p.mediaIds.length > 0 && (
            <div className="flex items-center gap-1.5">
              <FaImage className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Imagem</span>
            </div>
          )}
        </div>

        {/* Footer: Rede social + Código */}
        <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <FaInstagram className="size-3.5" />
            <span>• Feed</span>
          </div>
          {p.shortCode && <span className="font-mono">Código: {p.shortCode}</span>}
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


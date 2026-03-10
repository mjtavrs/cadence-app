"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrashIcon, Eye, Pencil, Copy, Clock3 } from "lucide-react";
import { SlOptionsVertical } from "react-icons/sl";
import { BsSendArrowUp } from "react-icons/bs";
import { FaImage, FaInstagram, FaRegCheckCircle } from "react-icons/fa";
import { LuCalendarPlus, LuCalendarSync, LuCalendarX2 } from "react-icons/lu";
import { BiCommentError, BiSolidCommentError } from "react-icons/bi";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
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
  flaggedAt?: string;
  flaggedByLabel?: string;
  flagReason?: string;
};

function statusRailClass(status: PostStatus) {
  if (status === "FAILED") return "border-l-destructive";
  if (status === "PUBLISHED") return "border-l-emerald-500";
  if (status === "SCHEDULED") return "border-l-cyan-500";
  if (status === "APPROVED") return "border-l-blue-500";
  if (status === "IN_REVIEW") return "border-l-amber-500";
  return "border-l-muted-foreground/60";
}

export function PostCard(props: {
  item: PostListItem;
  isBusy: boolean;
  isDeleting?: boolean;
  isHighlighted?: boolean;
  onSubmit?(): void;
  onApprove?(): void;
  onSchedule?(): void;
  onCancel?(): void;
  onRetry?(): void;
  onDelete(): void;
  onPreview?(): void;
  onDuplicate?(): void;
  onCaptionMore?: () => void;
  onFlag?(reason: string): void | Promise<void>;
  onUnflag?(): void | Promise<void>;
  submitLabel?: string;
}) {
  const p = props.item;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagDetailsOpen, setFlagDetailsOpen] = useState(false);
  const [unflagOpen, setUnflagOpen] = useState(false);
  const [flagReasonDraft, setFlagReasonDraft] = useState("");

  const titleSafe = (p.title ?? "").trim() || "Sem título";
  const captionSafe = typeof p.caption === "string" ? p.caption : "";
  const tagsSafe = useMemo(
    () => (Array.isArray(p.tags) ? p.tags.map((tag) => tag.trim()).filter(Boolean) : []),
    [p.tags],
  );
  const visibleTags = tagsSafe.slice(0, 4);
  const hiddenTagsCount = Math.max(0, tagsSafe.length - visibleTags.length);
  const mediaCount = Array.isArray(p.mediaIds) ? p.mediaIds.length : 0;
  const isDraft = p.status === "DRAFT";
  const isFlagged = !!p.flaggedAt;
  const canFlag = !!props.onFlag;
  const canUnflag = !!props.onUnflag;
  const isItemBusy = props.isBusy || !!props.isDeleting;

  function getStatusAction() {
    switch (p.status) {
      case "DRAFT":
        if (!props.onSubmit) return null;
        return { label: props.submitLabel ?? "Enviar para aprovação", action: props.onSubmit, icon: BsSendArrowUp };
      case "IN_REVIEW":
        if (!props.onApprove) return null;
        return { label: "Aprovar", action: props.onApprove, icon: FaRegCheckCircle };
      case "APPROVED":
        if (!props.onSchedule) return null;
        return { label: "Agendar", action: props.onSchedule, icon: LuCalendarPlus };
      case "SCHEDULED":
        if (!props.onCancel) return null;
        return { label: "Cancelar agendamento", action: props.onCancel, icon: LuCalendarX2 };
      case "FAILED":
        if (!props.onRetry) return null;
        return { label: "Reagendar (+2 min)", action: props.onRetry, icon: LuCalendarSync };
      default:
        return null;
    }
  }

  const statusAction = getStatusAction();
  const scheduleLabel = p.status === "IN_REVIEW" ? "Sugestão:" : "Agendado:";

  function openFlagDialog() {
    setFlagReasonDraft(p.flagReason ?? "");
    setFlagOpen(true);
  }

  return (
    <>
      <Card
        className={cn(
          "relative border border-border/70 border-l-4 p-4 transition-all duration-200 hover:shadow-sm",
          statusRailClass(p.status),
          isFlagged && "bg-amber-50/70 shadow-[0_0_0_1px_rgba(245,158,11,0.12)] dark:bg-amber-500/8",
          props.isHighlighted && "ring-2 ring-primary/45 shadow-[0_0_0_1px_rgba(34,197,94,0.08)]",
          isDraft && "bg-muted/20 [border-style:dashed] [border-left-style:solid]",
          props.isDeleting && "opacity-70",
        )}
      >
        {props.isDeleting ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-md border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
              <Spinner className="size-3" />
              Excluindo...
            </div>
          </div>
        ) : null}
        <div className="ml-1 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2.5">
              <h3 className="truncate text-lg font-semibold leading-tight">{titleSafe}</h3>
              <div className="flex flex-wrap items-center gap-2">
                {isFlagged ? (
                  <button
                    type="button"
                    className="inline-flex"
                    onClick={() => setFlagDetailsOpen(true)}
                    disabled={isItemBusy}
                  >
                    <Badge
                      variant="outline"
                      className="cursor-pointer gap-1.5 border-amber-500/60 bg-amber-500/15 text-amber-800 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
                    >
                      <BiSolidCommentError className="size-3.5" />
                      Post sinalizado. Clique para verificar.
                    </Badge>
                  </button>
                ) : null}
                <PostStatusBadge status={p.status} />
                {p.scheduledAtUtc ? (
                  <Badge variant="outline" className="gap-1 border-border/70 bg-background text-muted-foreground">
                    <Clock3 className="size-3.5" />
                    <span className="text-xs">
                      {scheduleLabel} {formatDateAndTime(p.scheduledAtUtc)}
                    </span>
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {(canFlag || canUnflag) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={isItemBusy}
                  aria-label={isFlagged ? "Dessinalizar post" : "Sinalizar post"}
                  onClick={() => {
                    if (isFlagged) {
                      setUnflagOpen(true);
                      return;
                    }
                    openFlagDialog();
                  }}
                >
                  {isFlagged ? <BiSolidCommentError className="size-4" /> : <BiCommentError className="size-4" />}
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={isItemBusy}
                    aria-label="Opções"
                  >
                    <SlOptionsVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {statusAction && (
                    <DropdownMenuItem onClick={statusAction.action} disabled={isItemBusy}>
                      <statusAction.icon className="size-4 shrink-0" />
                      {statusAction.label}
                    </DropdownMenuItem>
                  )}
                  {props.onPreview && (
                    <DropdownMenuItem onClick={props.onPreview} disabled={isItemBusy}>
                      <Eye className="size-4 shrink-0" />
                      Preview
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild disabled={isItemBusy}>
                    <Link href={`/app/posts/${encodeURIComponent(p.postId)}`}>
                      <Pencil className="size-4 shrink-0" />
                      Editar
                    </Link>
                  </DropdownMenuItem>
                  {props.onDuplicate && (
                    <DropdownMenuItem onClick={props.onDuplicate} disabled={isItemBusy}>
                      <Copy className="size-4 shrink-0" />
                      Duplicar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)} disabled={isItemBusy}>
                    <TrashIcon className="size-4 shrink-0" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm leading-relaxed text-muted-foreground">
              {captionSafe.length > 120 ? (
                <>
                  {captionSafe.slice(0, 120)}
                  <span className="text-muted-foreground">...</span>{" "}
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onCaptionMore?.();
                    }}
                  >
                    mais
                  </button>
                </>
              ) : (
                captionSafe || "Sem legenda"
              )}
            </div>

            {visibleTags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {visibleTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="border border-border/50 bg-muted/60 text-xs font-medium">
                    #{tag}
                  </Badge>
                ))}
                {hiddenTagsCount > 0 ? (
                  <Badge variant="outline" className="text-xs">
                    +{hiddenTagsCount}
                  </Badge>
                ) : null}
              </div>
            ) : null}

            {mediaCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1 border-border/70 bg-background text-xs text-muted-foreground">
                  <FaImage className="size-3.5" />
                  Imagem
                </Badge>
                <Badge variant="outline" className="border-border/70 bg-background text-xs text-muted-foreground">
                  {mediaCount} mídia{mediaCount > 1 ? "s" : ""}
                </Badge>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-border/70 pt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <FaInstagram className="size-3.5" />
              <span>Feed</span>
            </div>
            {p.shortCode ? <span className="font-mono">Código: {p.shortCode}</span> : null}
          </div>
        </div>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir post</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isItemBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isItemBusy}
              onClick={() => {
                setDeleteOpen(false);
                props.onDelete();
              }}
            >
              {props.isDeleting ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-3" />
                  Excluindo...
                </span>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sinalizar post</DialogTitle>
            <DialogDescription>
              Registre uma observação para indicar o que precisa ser revisado neste post.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={flagReasonDraft}
              onChange={(event) => setFlagReasonDraft(event.target.value)}
              placeholder="Ex.: imagem incorreta, legenda incompleta ou horário incorreto."
              maxLength={500}
              rows={5}
            />
            <div className="text-right text-xs text-muted-foreground">{flagReasonDraft.length}/500</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                const nextReason = flagReasonDraft.trim();
                if (!nextReason || !props.onFlag) return;
                await props.onFlag(nextReason);
                setFlagOpen(false);
              }}
              disabled={props.isBusy || !flagReasonDraft.trim()}
            >
              Sinalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={flagDetailsOpen} onOpenChange={setFlagDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Post sinalizado</DialogTitle>
            <DialogDescription>
              Detalhes da sinalização registrada para este post.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border/70 bg-muted/25 p-4 text-sm leading-relaxed">
              {p.flagReason?.trim() || "Nenhuma observação registrada."}
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              {p.flaggedByLabel ? <p>Por: {p.flaggedByLabel}</p> : null}
              {p.flaggedAt ? <p>Em: {formatDateAndTime(p.flaggedAt)}</p> : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagDetailsOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={unflagOpen} onOpenChange={setUnflagOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dessinalizar post</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a sinalização deste post?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!props.onUnflag) return;
                setUnflagOpen(false);
                await props.onUnflag();
              }}
            >
              Remover sinalização
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


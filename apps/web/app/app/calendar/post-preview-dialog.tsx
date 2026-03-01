"use client";

import Link from "next/link";
import { useState } from "react";
import { Clock3Icon, HashIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PostStatusBadge } from "@/components/posts/post-status-badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type PostStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED";

export type CalendarPreviewPost = {
  postId: string;
  status: PostStatus;
  title?: string;
  shortCode?: string;
  tags?: string[];
  caption: string;
  scheduledAtUtc?: string;
  mediaIds?: string[];
};

const tz = "America/Recife";

type MediaItem = {
  id: string;
  url: string;
  fileName: string | null;
};

function formatSchedule(isoUtc: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).formatToParts(new Date(isoUtc));

  const map = new Map(parts.map((p) => [p.type, p.value]));
  const day = map.get("day") ?? "--";
  const month = map.get("month") ?? "--";
  const hour = map.get("hour") ?? "--";
  const minute = map.get("minute") ?? "--";
  return `${day}/${month} às ${hour}:${minute}`;
}

export function PostPreviewDialog(props: {
  open: boolean;
  onOpenChange(open: boolean): void;
  post: CalendarPreviewPost | null;
}) {
  const p = props.post;
  const [captionExpanded, setCaptionExpanded] = useState(false);

  const mediaQuery = useQuery({
    queryKey: ["media"],
    queryFn: async () => {
      const res = await fetch("/api/media", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as { items?: MediaItem[] } | null;
      return payload?.items ?? [];
    },
    staleTime: 30_000,
    enabled: props.open && !!p?.mediaIds?.length,
  });

  const firstMedia = p?.mediaIds?.length
    ? (mediaQuery.data ?? []).find((m) => m.id === p.mediaIds?.[0]) ?? null
    : null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent key={p?.postId ?? "empty"} className="sm:max-w-[680px]">
        <DialogHeader>
          <div className="space-y-2">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate text-xl">{p?.title?.trim() ? p.title : "Sem título"}</span>
              {p?.shortCode ? (
                <Badge variant="outline" className="font-mono text-[11px]">
                  {p.shortCode}
                </Badge>
              ) : null}
            </DialogTitle>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              {p ? <PostStatusBadge status={p.status} /> : null}
              {p?.scheduledAtUtc ? (
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <Clock3Icon className="size-4" />
                  {formatSchedule(p.scheduledAtUtc)}
                </span>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        {p ? (
          <div className="space-y-4">
            <div className="h-56 overflow-hidden rounded-lg border bg-muted/20">
              {firstMedia?.url ? (
                <img
                  src={firstMedia.url}
                  alt={firstMedia.fileName ?? "Prévia do post"}
                  className="h-56 w-full object-cover"
                />
              ) : mediaQuery.isLoading ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                  Carregando imagem...
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                  Sem imagem de prévia
                </div>
              )}
            </div>

            {p.tags?.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
                  <HashIcon className="size-3.5" />
                  Tags
                </span>
                {p.tags.slice(0, 12).map((t) => (
                  <Badge key={t} variant="outline">
                    #{t}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="rounded-md border bg-muted/20 p-3">
              <div className="mb-1 text-xs font-medium text-muted-foreground">Legenda</div>
              <ScrollArea className={captionExpanded ? "h-52" : "h-20"}>
                <div className="whitespace-pre-wrap text-sm">{p.caption}</div>
              </ScrollArea>
              {p.caption.length > 220 ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                  onClick={() => setCaptionExpanded((v) => !v)}
                >
                  {captionExpanded ? "Ver menos" : "Ver legenda completa"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="secondary" onClick={() => props.onOpenChange(false)}>
            Fechar
          </Button>
          {p ? (
            <Button asChild>
              <Link href={`/app/posts/${encodeURIComponent(p.postId)}`}>Editar</Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

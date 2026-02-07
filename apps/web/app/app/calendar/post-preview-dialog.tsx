"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PostStatusBadge } from "@/components/posts/post-status-badge";

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
};

const tz = "America/Recife";

function formatTime(isoUtc: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(new Date(isoUtc));
}

export function PostPreviewDialog(props: {
  open: boolean;
  onOpenChange(open: boolean): void;
  post: CalendarPreviewPost | null;
}) {
  const p = props.post;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 truncate">{p?.title?.trim() ? p.title : "Sem título"}</span>
            {p?.shortCode ? (
              <Badge variant="outline" className="font-mono text-[11px]">
                {p.shortCode}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            {p ? <PostStatusBadge status={p.status} /> : null}
            {p?.scheduledAtUtc ? <span>Horário: {formatTime(p.scheduledAtUtc)} ({tz})</span> : null}
          </DialogDescription>
        </DialogHeader>

        {p ? (
          <div className="space-y-3">
            {p.tags?.length ? (
              <div className="flex flex-wrap gap-2">
                {p.tags.slice(0, 12).map((t) => (
                  <Badge key={t} variant="outline">
                    #{t}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="whitespace-pre-wrap text-sm">{p.caption}</div>
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


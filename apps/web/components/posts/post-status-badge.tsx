"use client";

import { Badge } from "@/components/ui/badge";

export type PostStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "FAILED";

const labels: Record<PostStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Aguardando aprovação",
  APPROVED: "Aprovado",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
};

const statusClasses: Record<PostStatus, string> = {
  DRAFT: "border-border bg-muted/40 text-foreground",
  IN_REVIEW: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  APPROVED: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  SCHEDULED: "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  PUBLISHED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  FAILED: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function PostStatusBadge(props: { status: PostStatus }) {
  return (
    <Badge variant="outline" className={statusClasses[props.status]}>
      {labels[props.status]}
    </Badge>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";

export type PostStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "FAILED";

const labels: Record<PostStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Pendente de aprovação",
  APPROVED: "Aprovado",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
};

export function PostStatusBadge(props: { status: PostStatus }) {
  if (props.status === "IN_REVIEW") {
    return (
      <Badge className="border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" variant="outline">
        {labels[props.status]}
      </Badge>
    );
  }

  const variant =
    props.status === "FAILED"
      ? "destructive"
      : props.status === "APPROVED" || props.status === "SCHEDULED" || props.status === "PUBLISHED"
        ? "default"
        : "outline";

  return <Badge variant={variant}>{labels[props.status]}</Badge>;
}

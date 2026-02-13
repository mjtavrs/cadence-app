"use client";

import { Badge } from "@/components/ui/badge";

export type PostStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "FAILED";

const labels: Record<PostStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em review",
  APPROVED: "Aprovado",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
};

export function PostStatusBadge(props: { status: PostStatus }) {
  const variant =
    props.status === "FAILED"
      ? "destructive"
      : props.status === "APPROVED" || props.status === "SCHEDULED" || props.status === "PUBLISHED"
        ? "default"
        : props.status === "IN_REVIEW"
          ? "secondary"
          : "outline";

  return <Badge variant={variant}>{labels[props.status]}</Badge>;
}


"use client";

import { CopyIcon, FilePenLineIcon, FileDownIcon, TrashIcon } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export type CalendarPostStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED";

export type CalendarPostContextMenuPost = {
  postId: string;
  status: CalendarPostStatus;
};

export function CalendarPostContextMenu(props: {
  post: CalendarPostContextMenuPost;
  children: React.ReactNode;
  onMoveToDraft: () => void;
  onCopyPost?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isBusy?: boolean;
}) {
  const { post, children, onMoveToDraft, onCopyPost, onEdit, onDelete, isBusy = false } = props;
  const canRevertToDraft = post.status !== "DRAFT";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={isBusy}>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          disabled={!canRevertToDraft}
          onSelect={() => {
            if (canRevertToDraft) onMoveToDraft();
          }}
        >
          <FileDownIcon />
          Mover para rascunho
        </ContextMenuItem>
        <ContextMenuItem onSelect={onEdit}>
          <FilePenLineIcon />
          Editar
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!onCopyPost}
          onSelect={() => onCopyPost?.()}
        >
          <CopyIcon />
          Copiar postagem
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <TrashIcon />
          Excluir
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

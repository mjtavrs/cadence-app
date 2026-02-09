"use client";

import { FilePenLineIcon, FileDownIcon, TrashIcon } from "lucide-react";

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
  onEdit: () => void;
  onDelete: () => void;
  isBusy?: boolean;
}) {
  const { post, children, onMoveToDraft, onEdit, onDelete, isBusy = false } = props;
  const canRevertToDraft = post.status !== "DRAFT";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={isBusy}>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          disabled={!canRevertToDraft}
          onSelect={(e) => {
            e.preventDefault();
            if (canRevertToDraft) onMoveToDraft();
          }}
        >
          <FileDownIcon />
          Mover para rascunho
        </ContextMenuItem>
        <ContextMenuItem onSelect={(e) => { e.preventDefault(); onEdit(); }}>
          <FilePenLineIcon />
          Editar
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); onDelete(); }}>
          <TrashIcon />
          Excluir
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

"use client";

import { ClipboardIcon, PlusIcon } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function CalendarCellContextMenu(props: {
  children: React.ReactNode;
  onCreatePost: () => void;
  onPastePost: () => void;
  canPaste: boolean;
  onOpenContextMenu?: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={props.onOpenContextMenu}>
        {props.children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={props.onCreatePost}
        >
          <PlusIcon />
          Criar postagem
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!props.canPaste}
          onSelect={() => {
            if (props.canPaste) props.onPastePost();
          }}
        >
          <ClipboardIcon />
          Colar postagem
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

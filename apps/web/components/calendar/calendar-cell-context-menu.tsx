"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ClipboardIcon, PlusIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const GLOBAL_EVENT_NAME = "cadence:calendar-cell-menu-open";

export function CalendarCellContextMenu(props: {
  children: React.ReactNode;
  onCreatePost: () => void;
  onPastePost: () => void;
  canPaste: boolean;
  onOpenContextMenu?: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  const instanceId = useId();
  const reopenTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [menuKey, setMenuKey] = useState(0);

  useEffect(() => {
    const onMenuOpened = (event: Event) => {
      const customEvent = event as CustomEvent<{ id: string }>;
      if (customEvent.detail?.id !== instanceId) {
        setOpen(false);
      }
    };

    window.addEventListener(GLOBAL_EVENT_NAME, onMenuOpened as EventListener);
    return () => {
      window.removeEventListener(GLOBAL_EVENT_NAME, onMenuOpened as EventListener);
      if (reopenTimerRef.current !== null) {
        window.clearTimeout(reopenTimerRef.current);
      }
    };
  }, [instanceId]);

  function requestOpenAt(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    props.onOpenContextMenu?.(event);

    const nextAnchor = { x: event.clientX, y: event.clientY };
    setAnchor(nextAnchor);
    setMenuKey((value) => value + 1);
    window.dispatchEvent(new CustomEvent(GLOBAL_EVENT_NAME, { detail: { id: instanceId } }));

    if (reopenTimerRef.current !== null) {
      window.clearTimeout(reopenTimerRef.current);
      reopenTimerRef.current = null;
    }

    if (open) {
      setOpen(false);
      reopenTimerRef.current = window.setTimeout(() => {
        setOpen(true);
        reopenTimerRef.current = null;
      }, 0);
      return;
    }

    setOpen(true);
  }

  return (
    <div className="h-full" onContextMenu={requestOpenAt}>
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            key={menuKey}
            type="button"
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none fixed size-0 opacity-0"
            style={{ left: anchor.x, top: anchor.y }}
          />
        </DropdownMenuTrigger>

        {props.children}

        <DropdownMenuContent align="start" sideOffset={4}>
          <DropdownMenuItem
            onSelect={() => {
              setOpen(false);
              props.onCreatePost();
            }}
          >
            <PlusIcon />
            Criar postagem
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!props.canPaste}
            onSelect={() => {
              setOpen(false);
              if (props.canPaste) props.onPastePost();
            }}
          >
            <ClipboardIcon />
            Colar postagem
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

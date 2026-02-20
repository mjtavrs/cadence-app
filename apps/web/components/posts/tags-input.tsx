"use client";

import { useRef, useState } from "react";
import { XIcon } from "lucide-react";

function normalizeTag(raw: string) {
  return raw.replace(/^#/, "").trim().toLowerCase();
}

export function TagsInput(props: {
  value: string[];
  onChange(tags: string[]): void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addFromText(text: string) {
    const parts = text.split(",");
    const next = [...props.value];
    for (const part of parts) {
      const t = normalizeTag(part);
      if (!t) continue;
      if (next.includes(t)) continue;
      next.push(t);
    }
    if (next.length !== props.value.length) {
      props.onChange(next);
    }
  }

  function remove(tag: string) {
    props.onChange(props.value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addFromText(draft);
      setDraft("");
    }
    if (e.key === "Backspace" && !draft && props.value.length > 0) {
      remove(props.value[props.value.length - 1]);
    }
  }

  return (
    <div
      className="border-input bg-background ring-ring/10 flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring"
      onClick={() => inputRef.current?.focus()}
    >
      {props.value.map((t) => (
        <span
          key={t}
          className="bg-muted text-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm"
        >
          {t}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground ml-0.5 inline-flex items-center"
            onClick={(e) => {
              e.stopPropagation();
              remove(t);
            }}
            aria-label={`Remover ${t}`}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className="placeholder:text-muted-foreground min-w-[80px] flex-1 border-0 bg-transparent p-0 text-sm outline-none"
        placeholder={props.value.length === 0 ? (props.placeholder ?? "Tags (separe por vírgula)") : ""}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!draft.trim()) return;
          addFromText(draft);
          setDraft("");
        }}
      />
    </div>
  );
}

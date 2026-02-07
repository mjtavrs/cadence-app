"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function normalizeTag(raw: string) {
  return raw.trim().toLowerCase();
}

export function TagsInput(props: {
  value: string[];
  onChange(tags: string[]): void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function addFromText(text: string) {
    const parts = text.split(",");
    const next = [...props.value];
    for (const part of parts) {
      const t = normalizeTag(part);
      if (!t) continue;
      if (next.includes(t)) continue;
      next.push(t);
    }
    props.onChange(next);
  }

  function remove(tag: string) {
    props.onChange(props.value.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-2">
      <Input
        placeholder={props.placeholder ?? "Tags (separe por vírgula)"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addFromText(draft);
            setDraft("");
          }
        }}
        onBlur={() => {
          if (!draft.trim()) return;
          addFromText(draft);
          setDraft("");
        }}
      />

      {props.value.length ? (
        <div className="flex flex-wrap gap-2">
          {props.value.map((t) => (
            <Badge key={t} variant="outline" className="gap-1">
              <span>#{t}</span>
              <Button type="button" size="icon-xs" variant="ghost" onClick={() => remove(t)} aria-label={`Remover ${t}`}>
                <XIcon className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}


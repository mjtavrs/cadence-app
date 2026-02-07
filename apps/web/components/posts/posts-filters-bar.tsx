"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PostStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "FAILED";

const statusLabels: Record<PostStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em review",
  APPROVED: "Aprovado",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
};

function normalizeTag(raw: string) {
  return raw.trim().toLowerCase();
}

export function PostsFiltersBar(props: {
  status: "ALL" | PostStatus;
  onStatusChange(value: "ALL" | PostStatus): void;
  tags: string[];
  onTagsChange(tags: string[]): void;
  onResolveCode(code: string): Promise<void>;
}) {
  const [tagDraft, setTagDraft] = useState("");
  const [codeDraft, setCodeDraft] = useState("");

  const statusOptions = useMemo(() => {
    return ["ALL", "DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "FAILED"] as const;
  }, []);

  function isStatus(value: string): value is "ALL" | PostStatus {
    return (statusOptions as readonly string[]).includes(value);
  }

  function addTagsFromText(text: string) {
    const parts = text.split(",");
    const next = [...props.tags];
    for (const part of parts) {
      const t = normalizeTag(part);
      if (!t) continue;
      if (next.includes(t)) continue;
      next.push(t);
    }
    props.onTagsChange(next);
  }

  function removeTag(tag: string) {
    props.onTagsChange(props.tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={props.status}
          onValueChange={(v) => {
            if (isStatus(v)) props.onStatusChange(v);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "ALL" ? "Todos" : statusLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Input
            placeholder="Tags (separe por vírgula)"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTagsFromText(tagDraft);
                setTagDraft("");
              }
            }}
            onBlur={() => {
              if (!tagDraft.trim()) return;
              addTagsFromText(tagDraft);
              setTagDraft("");
            }}
            className="w-[260px]"
          />

          {props.tags.map((t) => (
            <Badge key={t} variant="outline" className="gap-1">
              <span className="truncate">#{t}</span>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                onClick={() => removeTag(t)}
                aria-label={`Remover tag ${t}`}
              >
                <XIcon className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Abrir por código (ex: C7D4K9)"
          value={codeDraft}
          onChange={(e) => setCodeDraft(e.target.value)}
          className="w-[220px]"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            const code = codeDraft.trim();
            if (!code) return;
            try {
              await props.onResolveCode(code);
              setCodeDraft("");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Não foi possível abrir pelo código.");
            }
          }}
        >
          Abrir
        </Button>
      </div>
    </div>
  );
}


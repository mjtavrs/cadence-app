"use client";

import { useMemo } from "react";
import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { TagsInput } from "@/components/posts/tags-input";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { formatRecifeDateTimeShort } from "@/lib/datetime";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const CAPTION_LIMIT = 2200;

function FieldHelper(props: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-foreground inline-flex" aria-label="Ajuda">
          <HelpCircle className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-balance">
        {props.text}
      </TooltipContent>
    </Tooltip>
  );
}

export function PostInfoPanel(props: {
  title: string;
  onTitleChange: (v: string) => void;
  tags: string[];
  onTagsChange: (v: string[]) => void;
  caption: string;
  onCaptionChange: (v: string) => void;
  scheduledAtUtc: string | null;
  onOpenSchedule: () => void;
  saving: boolean;
  onSaveDraft: () => void;
  onSchedulePost: () => void;
  primaryActionLabel?: string;
  primaryActionHint?: string;
}) {
  const captionLength = useMemo(() => props.caption.length, [props.caption]);

  return (
    <div className="space-y-5">
      <Alert className="border-amber-300/70 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
        <AlertTitle>No MVP, cada post aceita 1 imagem.</AlertTitle>
        <AlertDescription className="text-amber-800">
          Vídeo e carrossel entram na próxima fase.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">Título</span>
          <FieldHelper text="Essas informações são para organização interna do workspace e não interferem no seu post." />
        </div>
        <Input
          value={props.title}
          onChange={(e) => props.onTitleChange(e.target.value)}
          placeholder="Ex.: Post do Dia das Mães"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">Tags</span>
          <FieldHelper text="Essas informações são para organização interna do workspace e não interferem no seu post." />
        </div>
        <TagsInput value={props.tags} onChange={props.onTagsChange} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">Legenda</span>
          <FieldHelper text="Essa legenda será incluída no seu post." />
        </div>
        <Textarea
          value={props.caption}
          onChange={(e) => {
            if (e.target.value.length <= CAPTION_LIMIT) {
              props.onCaptionChange(e.target.value);
            }
          }}
          rows={16}
          placeholder="Escreva a legenda do seu post..."
        />
        <div className="flex items-center justify-between">
          <EmojiPicker onSelect={(emoji) => props.onCaptionChange(props.caption + emoji)} />
          <span className="text-muted-foreground text-xs tabular-nums">
            {captionLength}/{CAPTION_LIMIT}
          </span>
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <div className="text-sm font-medium">Data e hora da publicação</div>
        {props.scheduledAtUtc ? (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {formatRecifeDateTimeShort(props.scheduledAtUtc)}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={props.onOpenSchedule}>
              Alterar
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="w-full" onClick={props.onOpenSchedule}>
            Definir data e hora
          </Button>
        )}
      </div>

      <Separator />

      <div className="flex gap-3 pt-1">
        <Button
          variant="outline"
          className="flex-1"
          disabled={props.saving}
          onClick={props.onSaveDraft}
        >
          {props.saving ? "Salvando..." : "Salvar para rascunho"}
        </Button>
        <Button
          className="flex-1"
          disabled={props.saving}
          onClick={props.onSchedulePost}
        >
          {props.saving ? "Salvando..." : props.primaryActionLabel ?? "Agendar post"}
        </Button>
      </div>
      {props.primaryActionHint ? (
        <p className="text-muted-foreground text-xs">{props.primaryActionHint}</p>
      ) : null}
    </div>
  );
}

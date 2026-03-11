"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HelpCircle } from "lucide-react";

import { MediaLibraryDialog } from "@/components/posts/media-library-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Page, PageActions, PageDescription, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";
import { TagsInput } from "@/components/posts/tags-input";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SchedulePostDialog } from "@/components/posts/schedule-post-dialog";
import { PostPreviewCrop, type CropData, type PreviewAspectRatio } from "@/components/posts/post-preview-crop";
import { preloadEmojiCatalog } from "@/lib/emoji-catalog";
import { getCalendarDateAndTimeFromUtcRecife, getNextQuarterSlotInTimeZone, formatRecifeDateTimeShort } from "@/lib/datetime";

const CAPTION_LIMIT = 2200;

type MediaListResponse = { items: MediaItem[] };
type PresignResponse = { mediaId: string; s3Key: string; uploadUrl: string };

export type MediaItem = {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  fileName: string | null;
  createdAt: string;
};

export type EditablePost = {
  postId: string;
  title?: string;
  shortCode?: string;
  tags?: string[];
  caption: string;
  mediaIds: string[];
  status: string;
  scheduledAtUtc?: string;
  aspectRatio?: "original" | "1:1" | "4:5" | "16:9";
  cropX?: number;
  cropY?: number;
};

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

function normalizeTitle(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

function isAspectRatio(value: string | undefined): value is PreviewAspectRatio {
  return value === "original" || value === "1:1" || value === "4:5" || value === "16:9";
}

function clampCrop(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

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

export function EditPostClient(props: { initialPost: EditablePost; initialMedia: MediaItem[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    preloadEmojiCatalog();
  }, []);

  const initialAspect = isAspectRatio(props.initialPost.aspectRatio) ? props.initialPost.aspectRatio : "1:1";
  const initialScheduledAt = props.initialPost.scheduledAtUtc ?? null;

  const [title, setTitle] = useState(props.initialPost.title ?? "");
  const [caption, setCaption] = useState(props.initialPost.caption ?? "");
  const [tags, setTags] = useState<string[]>(props.initialPost.tags ?? []);
  const [media, setMedia] = useState<MediaItem[]>(props.initialMedia);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(props.initialPost.mediaIds?.[0] ?? null);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [pickedMediaId, setPickedMediaId] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduledAtUtc, setScheduledAtUtc] = useState<string | null>(initialScheduledAt);
  const [aspectRatio, setAspectRatio] = useState<PreviewAspectRatio>(initialAspect);
  const [cropData, setCropData] = useState<CropData | null>({
    aspectRatio: initialAspect,
    cropX: clampCrop(props.initialPost.cropX),
    cropY: clampCrop(props.initialPost.cropY),
  });
  const [saving, setSaving] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);

  const selectedMedia = useMemo(
    () => media.find((m) => m.id === selectedMediaId) ?? null,
    [media, selectedMediaId],
  );

  const scheduleDefault = useMemo(() => {
    if (scheduledAtUtc) {
      const scheduled = getCalendarDateAndTimeFromUtcRecife(scheduledAtUtc, "America/Recife");
      if (scheduled) return scheduled;
    }
    return getNextQuarterSlotInTimeZone(new Date(), "America/Recife");
  }, [scheduledAtUtc]);

  const normalizedTitle = useMemo(() => normalizeTitle(title), [title]);
  const captionLength = caption.length;
  const canScheduleOnSave = useMemo(
    () => ["DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED"].includes(props.initialPost.status),
    [props.initialPost.status],
  );

  async function reloadMedia() {
    const res = await fetch("/api/media", { cache: "no-store" });
    const payload = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao carregar mídias.");
    const items = ((payload as MediaListResponse | null)?.items ?? []) as MediaItem[];
    setMedia(items);
    return items;
  }

  async function uploadFromDevice(file: File) {
    setUploadPending(true);
    try {
      const presignRes = await fetch("/api/media/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type, fileName: file.name, sizeBytes: file.size }),
      });
      const presignPayload = (await presignRes.json().catch(() => null)) as unknown;
      if (!presignRes.ok) throw new Error(getErrorMessage(presignPayload) ?? "Falha ao preparar upload.");
      const presign = presignPayload as PresignResponse;

      const uploadRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Falha no upload da imagem.");

      const createRes = await fetch("/api/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mediaId: presign.mediaId,
          s3Key: presign.s3Key,
          contentType: file.type,
          sizeBytes: file.size,
          fileName: file.name,
        }),
      });
      const createPayload = (await createRes.json().catch(() => null)) as unknown;
      if (!createRes.ok) throw new Error(getErrorMessage(createPayload) ?? "Falha ao registrar mídia.");

      await reloadMedia();
      setSelectedMediaId(presign.mediaId);
      toast.success("Imagem enviada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar imagem.");
    } finally {
      setUploadPending(false);
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    void uploadFromDevice(file);
  }

  function openLibraryDialog() {
    setPickedMediaId(selectedMediaId);
    setLibraryDialogOpen(true);
  }

  async function confirmLibraryPick(id: string) {
    setSelectedMediaId(id);
    setLibraryDialogOpen(false);

    if (!media.some((m) => m.id === id)) {
      try {
        await reloadMedia();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao atualizar biblioteca.");
      }
    }
  }

  async function save() {
    if (!normalizedTitle) {
      toast.error("O título não pode estar vazio.");
      return;
    }
    if (!caption.trim()) {
      toast.error("A legenda não pode estar vazia.");
      return;
    }
    if (captionLength > CAPTION_LIMIT) {
      toast.error(`A legenda deve ter no máximo ${CAPTION_LIMIT} caracteres.`);
      return;
    }
    if (!selectedMediaId) {
      toast.error("Selecione uma imagem.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(props.initialPost.postId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: normalizedTitle,
          caption,
          tags,
          mediaIds: [selectedMediaId],
          aspectRatio,
          cropX: typeof cropData?.cropX === "number" ? cropData.cropX : 0.5,
          cropY: typeof cropData?.cropY === "number" ? cropData.cropY : 0.5,
        }),
      });

      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        throw new Error(getErrorMessage(payload) ?? "Falha ao salvar post.");
      }

      if (scheduledAtUtc && canScheduleOnSave) {
        const scheduleRes = await fetch(`/api/posts/${encodeURIComponent(props.initialPost.postId)}/schedule`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scheduledAtUtc }),
        });
        const schedulePayload = (await scheduleRes.json().catch(() => null)) as unknown;
        if (!scheduleRes.ok) {
          throw new Error(getErrorMessage(schedulePayload) ?? "Falha ao atualizar agendamento.");
        }
      }

      toast.success("Post atualizado.");
      router.replace("/app/posts");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar post.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        onChange={onFileSelected}
      />

      <PageHeader>
        <PageHeaderText>
          <PageTitle>Editar post</PageTitle>
          <PageDescription>
            {props.initialPost.shortCode ? `Código: ${props.initialPost.shortCode}` : "Edite título, tags, legenda e imagem."}
          </PageDescription>
        </PageHeaderText>
        <PageActions>
          <Button variant="secondary" asChild>
            <Link href="/app/posts">Voltar</Link>
          </Button>
          <Button disabled={saving || uploadPending} onClick={() => void save()}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Spinner data-icon="inline-start" />
                Salvando...
              </span>
            ) : (
              "Salvar"
            )}
          </Button>
        </PageActions>
      </PageHeader>

      <div className="mx-auto grid max-w-[1060px] gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-3 sm:p-4">
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Alterar mídia do post</div>
                  <div className="text-muted-foreground text-sm">
                    Envie uma nova imagem ou escolha outra da biblioteca.
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={uploadPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadPending ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner data-icon="inline-start" />
                        Enviando...
                      </span>
                    ) : (
                      "Enviar imagem"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={uploadPending}
                    onClick={openLibraryDialog}
                  >
                    Biblioteca
                  </Button>
                </div>
              </div>
            </div>

            <PostPreviewCrop
              imageSrc={selectedMedia?.url ?? null}
              imageAlt={selectedMedia?.fileName ?? "Mídia selecionada"}
              aspectRatio={aspectRatio}
              cropData={cropData}
              onAspectRatioChange={(value) => {
                setAspectRatio(value);
                setCropData((prev) => ({
                  aspectRatio: value,
                  cropX: prev?.cropX ?? 0.5,
                  cropY: prev?.cropY ?? 0.5,
                }));
              }}
              onCropChange={setCropData}
              emptyPlaceholder="Selecione uma imagem"
              isLoading={uploadPending}
            />
          </div>
        </Card>

        <Card className="h-fit p-3 sm:p-4">
          <div className="space-y-5">
            <Alert className="border-amber-300/70 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
              <AlertTitle>No MVP, cada post aceita 1 imagem.</AlertTitle>
              <AlertDescription className="text-amber-800">Vídeo e carrossel entram na próxima fase.</AlertDescription>
            </Alert>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">Título</span>
                <FieldHelper text="Essas informações são para organização interna do workspace e não interferem no seu post." />
              </div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Post do Dia das Maes" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">Tags</span>
                <FieldHelper text="Essas informações são para organização interna do workspace e não interferem no seu post." />
              </div>
              <TagsInput value={tags} onChange={setTags} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">Legenda</span>
                <FieldHelper text="Essa legenda será incluída no seu post." />
              </div>
              <Textarea
                value={caption}
                onChange={(e) => {
                  if (e.target.value.length <= CAPTION_LIMIT) {
                    setCaption(e.target.value);
                  }
                }}
                rows={16}
                placeholder="Escreva a legenda do seu post..."
              />
              <div className="flex items-center justify-between">
                <EmojiPicker
                  onSelect={(emoji) => {
                    const next = `${caption}${emoji}`;
                    if (next.length <= CAPTION_LIMIT) setCaption(next);
                  }}
                />
                <span className="text-muted-foreground text-xs tabular-nums">
                  {captionLength}/{CAPTION_LIMIT}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-sm font-medium">Data e hora da publicação</div>
              {canScheduleOnSave ? (
                scheduledAtUtc ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{formatRecifeDateTimeShort(scheduledAtUtc)}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setScheduleModalOpen(true)}>
                      Alterar
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full" onClick={() => setScheduleModalOpen(true)}>
                    Definir data e hora
                  </Button>
                )
              ) : (
                <div className="text-muted-foreground rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  Agendamento indisponível para o status atual.
                </div>
              )}
            </div>

            <Separator />

            <Button className="w-full" disabled={saving || uploadPending} onClick={() => void save()}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner data-icon="inline-start" />
                  Salvando...
                </span>
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </div>
        </Card>
      </div>

      <MediaLibraryDialog
        open={libraryDialogOpen}
        onOpenChange={setLibraryDialogOpen}
        media={media}
        mediaLoading={false}
        pickedMediaId={pickedMediaId}
        onPickedMediaIdChange={setPickedMediaId}
        onConfirmSelection={confirmLibraryPick}
        confirmLabel="Usar mídia"
      />

      <SchedulePostDialog
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        postId={props.initialPost.postId}
        defaultDate={scheduleDefault.dateForCalendar}
        defaultTimeHHmm={scheduleDefault.time}
        onSelectScheduledAtUtc={setScheduledAtUtc}
      />
    </Page>
  );
}

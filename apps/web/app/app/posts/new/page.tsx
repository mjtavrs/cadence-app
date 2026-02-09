"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Page, PageActions, PageDescription, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";
import { TagsInput } from "@/components/posts/tags-input";
import { SchedulePostDialog } from "@/components/posts/schedule-post-dialog";
import { PostPreviewCrop, type PreviewAspectRatio } from "@/components/posts/post-preview-crop";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getNextQuarterSlotInTimeZone } from "@/lib/datetime";
import { formatRecifeDateTimeShort } from "@/lib/datetime";

type MediaItem = {
  id: string;
  url: string;
  fileName: string | null;
  createdAt: string;
};

type MediaListResponse = {
  items: MediaItem[];
};

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

type PresignResponse = { mediaId: string; s3Key: string; uploadUrl: string };

export default function NewPostPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scheduledAtUtc, setScheduledAtUtc] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [pickedMediaId, setPickedMediaId] = useState<string | null>(null);
  const [previewAspect, setPreviewAspect] = useState<PreviewAspectRatio>("1:1");

  const scheduleDefault = useMemo(() => getNextQuarterSlotInTimeZone(), []);

  function openLibraryDialog() {
    setPickedMediaId(selectedMediaId);
    setLibraryDialogOpen(true);
  }

  function confirmLibraryPick() {
    if (pickedMediaId) setSelectedMediaId(pickedMediaId);
    setLibraryDialogOpen(false);
  }

  const normalizedTitle = useMemo(() => title.replace(/\s+/g, " ").trim(), [title]);
  const normalizedCaption = useMemo(() => caption.replace(/\s+/g, " ").trim(), [caption]);

  const mediaQuery = useQuery({
    queryKey: ["media"],
    queryFn: async () => {
      const res = await fetch("/api/media", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao carregar mídias.");
      const data = payload as MediaListResponse;
      return data.items ?? [];
    },
    staleTime: 30_000,
  });

  const uploadFromDeviceMutation = useMutation({
    mutationFn: async (file: File) => {
      const presignRes = await fetch("/api/media/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type, fileName: file.name, sizeBytes: file.size }),
      });
      const presignPayload = (await presignRes.json().catch(() => null)) as unknown;
      if (!presignRes.ok) throw new Error(getErrorMessage(presignPayload) ?? "Falha ao preparar upload.");
      const presign = presignPayload as PresignResponse;
      const uploadRes = await fetch(presign.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!uploadRes.ok) throw new Error("Falha no upload.");
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
      return (createPayload as { id?: string })?.id ?? presign.mediaId;
    },
    onSuccess: (mediaId) => {
      setSelectedMediaId(mediaId);
      queryClient.invalidateQueries({ queryKey: ["media"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao enviar imagem."),
  });

  const media = useMemo(() => mediaQuery.data ?? [], [mediaQuery.data]);
  const selected = useMemo(() => media.find((m) => m.id === selectedMediaId) ?? null, [media, selectedMediaId]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    uploadFromDeviceMutation.mutate(file);
  }

  async function save() {
    if (!normalizedTitle) {
      toast.error("O título não pode estar vazio.");
      return;
    }
    if (!normalizedCaption) {
      toast.error("A legenda não pode estar vazia.");
      return;
    }
    if (!selectedMediaId) {
      toast.error("Selecione uma imagem.");
      return;
    }

    setSaving(true);
    const body: Record<string, unknown> = {
      title: normalizedTitle,
      caption: normalizedCaption,
      tags,
      mediaIds: [selectedMediaId],
    };
    if (scheduledAtUtc) body.scheduledAtUtc = scheduledAtUtc;
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      toast.error(getErrorMessage(payload) ?? "Falha ao criar post.");
      setSaving(false);
      return;
    }
    setSaving(false);
    toast.success("Post criado.");
    router.replace("/app/posts");
  }

  return (
    <Page>
      <PageHeader>
        <PageHeaderText>
          <PageTitle>Novo post</PageTitle>
          <PageDescription>No MVP, cada post tem 1 imagem + legenda.</PageDescription>
        </PageHeaderText>
        <PageActions>
          <Button variant="secondary" asChild>
            <Link href="/app/posts">Voltar</Link>
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex justify-center">
        <div className="flex flex-wrap gap-6">
          <Card className="flex w-[732px] max-w-[calc(100vw-2rem)] p-4 shrink-0 flex-col overflow-hidden">
          <div className="border-b flex pb-4 items-center justify-center px-4 text-sm font-medium">
            Prévia
          </div>
          <div className="flex flex-col items-center p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-hidden
              onChange={onFileSelected}
            />
            <div className="w-full min-w-0" style={{ maxWidth: 700 }}>
              <PostPreviewCrop
                imageSrc={selected?.url ?? null}
                imageAlt={selected?.fileName ?? undefined}
                aspectRatio={previewAspect}
                onAspectRatioChange={setPreviewAspect}
                emptyPlaceholder="Escolha uma foto do seu dispositivo"
                onEmptyAreaClick={openFilePicker}
                isLoading={uploadFromDeviceMutation.isPending}
              />
            </div>
            <div className="mt-3 w-full" style={{ maxWidth: 700 }}>
              <Button variant="default" size="sm" className="w-full" onClick={openLibraryDialog}>
                Ou escolha da sua biblioteca
              </Button>
            </div>
          </div>
          </Card>

          <Card className="w-[420px] shrink-0 p-4 h-fit">
            <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Título</div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Post do Dia das Mães" />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Tags</div>
              <TagsInput value={tags} onChange={setTags} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Legenda</div>
                <EmojiPicker onSelect={(emoji) => setCaption((c) => `${c}${emoji}`)} />
              </div>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={8} />
              <div className="text-muted-foreground text-xs">
                {normalizedCaption.length ? `${normalizedCaption.length} caractere(s)` : "Vazio"}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Data e hora de publicação</div>
              {scheduledAtUtc ? (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    {formatRecifeDateTimeShort(scheduledAtUtc)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setScheduleModalOpen(true)}
                  >
                    Alterar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setScheduleModalOpen(true)}
                >
                  Definir data e hora
                </Button>
              )}
            </div>

            <Button className="w-full" disabled={saving} onClick={() => void save()}>
              {saving ? "Salvando..." : "Criar post"}
            </Button>
            </div>
          </Card>
        </div>
      </div>

      <SchedulePostDialog
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        postId={null}
        defaultDate={scheduleDefault.dateForCalendar}
        defaultTimeHHmm={scheduleDefault.time}
        onSelectScheduledAtUtc={setScheduledAtUtc}
      />

      <Dialog open={libraryDialogOpen} onOpenChange={setLibraryDialogOpen}>
        <DialogContent className="sm:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>Biblioteca de mídia</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            {mediaQuery.isLoading ? (
              <p className="text-muted-foreground py-4 text-sm">Carregando...</p>
            ) : media.length === 0 ? (
              <p className="text-muted-foreground py-4 text-sm">Nenhuma mídia disponível. Envie arquivos em Mídia.</p>
            ) : (
              <div className="grid grid-cols-4 gap-3 py-2">
                {media.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                      pickedMediaId === m.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setPickedMediaId(m.id)}
                    title={m.fileName ?? m.id}
                  >
                    <img src={m.url} alt={m.fileName ?? "mídia"} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLibraryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmLibraryPick} disabled={!pickedMediaId}>
              Abrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}


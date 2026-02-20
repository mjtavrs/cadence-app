"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Page, PageActions, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";
import { SchedulePostDialog } from "@/components/posts/schedule-post-dialog";
import { type PreviewAspectRatio, type CropData } from "@/components/posts/post-preview-crop";
import { StepHeader, type CreationStep } from "@/components/posts/create/step-header";
import { StepSelectMedia, type MediaItem } from "@/components/posts/create/step-select-media";
import { StepCropAdjust } from "@/components/posts/create/step-crop-adjust";
import { StepCreatePost } from "@/components/posts/create/step-create-post";
import { getNextQuarterSlotInTimeZone } from "@/lib/datetime";
import { useWorkspaceRole } from "@/hooks/use-workspace-role";

type MediaListResponse = { items: MediaItem[] };
type PresignResponse = { mediaId: string; s3Key: string; uploadUrl: string };

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

export default function NewPostPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role } = useWorkspaceRole();

  const [step, setStep] = useState<CreationStep>("select");
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
  const [cropData, setCropData] = useState<CropData | null>(null);

  const scheduleDefault = useMemo(() => getNextQuarterSlotInTimeZone(), []);

  const normalizedTitle = useMemo(() => title.replace(/\s+/g, " ").trim(), [title]);
  const normalizedCaption = useMemo(() => caption.replace(/\s+/g, " ").trim(), [caption]);

  const mediaQuery = useQuery({
    queryKey: ["media"],
    queryFn: async () => {
      const res = await fetch("/api/media", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao carregar mídias.");
      return ((payload as MediaListResponse).items ?? []) as MediaItem[];
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

  function confirmLibraryPick() {
    if (pickedMediaId) setSelectedMediaId(pickedMediaId);
    setLibraryDialogOpen(false);
  }

  function handleAdvance() {
    if (step === "select") setStep("crop");
    else if (step === "crop") setStep("create");
  }

  function handleBack() {
    if (step === "crop") setStep("select");
    else if (step === "create") setStep("crop");
  }

  async function savePost(asDraft: boolean) {
    if (!selectedMediaId) {
      toast.error("Selecione uma imagem.");
      return;
    }
    if (!asDraft && !normalizedCaption) {
      toast.error("A legenda não pode estar vazia.");
      return;
    }
    if (!asDraft && !scheduledAtUtc) {
      toast.error("Defina uma data e hora para agendar o post.");
      return;
    }

    setSaving(true);
    const body: Record<string, unknown> = {
      title: normalizedTitle || undefined,
      caption: normalizedCaption || undefined,
      tags,
      mediaIds: [selectedMediaId],
      aspectRatio: previewAspect,
      cropX: typeof cropData?.cropX === "number" ? cropData.cropX : 0.5,
      cropY: typeof cropData?.cropY === "number" ? cropData.cropY : 0.5,
    };

    if (asDraft) {
      body.saveAsDraft = true;
    } else {
      body.scheduledAtUtc = scheduledAtUtc;
      if (role === "OWNER") {
        body.directSchedule = true;
      }
    }

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

    if (asDraft) {
      toast.success("Rascunho salvo.");
    } else if (role === "OWNER") {
      toast.success("Post agendado.");
    } else {
      toast.success("Post criado. Aguardando aprovação.");
    }
    router.replace("/app/posts");
  }

  const canAdvance = step === "select" ? !!selectedMediaId : true;

  return (
    <Page>
      <PageHeader>
        <PageHeaderText>
          <PageTitle>Novo post</PageTitle>
        </PageHeaderText>
        <PageActions>
          <Button variant="secondary" asChild>
            <Link href="/app/posts">Voltar</Link>
          </Button>
        </PageActions>
      </PageHeader>

      <div className="mx-auto flex max-w-4xl items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground mb-4">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>Por enquanto, apenas 1 imagem é permitida por post.</span>
      </div>

      <div className="flex justify-center">
        {step === "create" ? (
          <div className="w-full max-w-[1140px]">
            <Card className="mb-4 p-4">
              <StepHeader
                step={step}
                canAdvance={false}
                onBack={handleBack}
              />
            </Card>
            <StepCreatePost
              imageSrc={selected?.url ?? null}
              imageAlt={selected?.fileName ?? undefined}
              aspectRatio={previewAspect}
              cropData={cropData}
              title={title}
              onTitleChange={setTitle}
              tags={tags}
              onTagsChange={setTags}
              caption={caption}
              onCaptionChange={setCaption}
              scheduledAtUtc={scheduledAtUtc}
              onOpenSchedule={() => setScheduleModalOpen(true)}
              saving={saving}
              onSaveDraft={() => void savePost(true)}
              onSchedulePost={() => void savePost(false)}
            />
          </div>
        ) : (
          <Card className="flex w-[732px] max-w-[calc(100vw-2rem)] shrink-0 flex-col overflow-hidden p-4">
            <StepHeader
              step={step}
              canAdvance={canAdvance}
              onBack={step !== "select" ? handleBack : undefined}
              onAdvance={handleAdvance}
            />
            {step === "select" && (
              <StepSelectMedia
                media={media}
                mediaLoading={mediaQuery.isLoading}
                selectedMediaId={selectedMediaId}
                onSelectMedia={setSelectedMediaId}
                onUploadFile={(file) => uploadFromDeviceMutation.mutate(file)}
                uploadPending={uploadFromDeviceMutation.isPending}
                libraryDialogOpen={libraryDialogOpen}
                onLibraryDialogOpenChange={setLibraryDialogOpen}
                pickedMediaId={pickedMediaId}
                onPickedMediaIdChange={setPickedMediaId}
                onConfirmLibraryPick={confirmLibraryPick}
              />
            )}
            {step === "crop" && (
              <StepCropAdjust
                imageSrc={selected?.url ?? null}
                imageAlt={selected?.fileName ?? undefined}
                aspectRatio={previewAspect}
                onAspectRatioChange={(newAspect) => {
                  setPreviewAspect(newAspect);
                  setCropData(null);
                }}
                onCropChange={setCropData}
              />
            )}
          </Card>
        )}
      </div>

      <SchedulePostDialog
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        postId={null}
        defaultDate={scheduleDefault.dateForCalendar}
        defaultTimeHHmm={scheduleDefault.time}
        onSelectScheduledAtUtc={setScheduledAtUtc}
      />
    </Page>
  );
}

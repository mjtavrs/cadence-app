"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Page, PageActions, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SchedulePostDialog } from "@/components/posts/schedule-post-dialog";
import { type PreviewAspectRatio, type CropData } from "@/components/posts/post-preview-crop";
import { StepHeader, type CreationStep } from "@/components/posts/create/step-header";
import { StepSelectMedia, type MediaItem } from "@/components/posts/create/step-select-media";
import { StepCropAdjust } from "@/components/posts/create/step-crop-adjust";
import { StepCreatePost } from "@/components/posts/create/step-create-post";
import {
  buildUtcIsoFromRecifeSelection,
  getCalendarDateAndTimeFromUtcRecife,
  getNextQuarterSlotInTimeZone,
} from "@/lib/datetime";
import { useWorkspaceRole } from "@/hooks/use-workspace-role";
import { preloadEmojiCatalog } from "@/lib/emoji-catalog";
import { cn } from "@/lib/utils";

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
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { role } = useWorkspaceRole();
  const canManageApproval = role === "OWNER" || role === "ADMIN";
  const prefilledScheduledAtUtc = useMemo(() => {
    const directIso = searchParams.get("prefillScheduledAtUtc")?.trim();
    if (directIso) {
      const dt = new Date(directIso);
      if (!Number.isNaN(dt.getTime())) return dt.toISOString();
    }

    const date = searchParams.get("prefillDate")?.trim();
    const time = searchParams.get("prefillTime")?.trim();
    if (!date || !time) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) return null;
    try {
      const selectedDate = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
      return buildUtcIsoFromRecifeSelection({
        selectedDate,
        timeHHmm: time,
        timeZone: "America/Recife",
      });
    } catch {
      return null;
    }
  }, [searchParams]);

  const [step, setStep] = useState<CreationStep>("select");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<"draft" | "schedule" | null>(null);
  const [scheduledAtUtc, setScheduledAtUtc] = useState<string | null>(prefilledScheduledAtUtc);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [pickedMediaId, setPickedMediaId] = useState<string | null>(null);
  const [previewAspect, setPreviewAspect] = useState<PreviewAspectRatio>("1:1");
  const [cropData, setCropData] = useState<CropData | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<"forward" | "backward">("forward");
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  useEffect(() => {
    preloadEmojiCatalog();
  }, []);

  const scheduleDefault = useMemo(() => {
    if (scheduledAtUtc) {
      const scheduled = getCalendarDateAndTimeFromUtcRecife(scheduledAtUtc, "America/Recife");
      if (scheduled) return scheduled;
    }
    return getNextQuarterSlotInTimeZone();
  }, [scheduledAtUtc]);

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

  const transitionClass =
    transitionDirection === "forward"
      ? "animate-in fade-in-0 slide-in-from-right-3 duration-200"
      : "animate-in fade-in-0 slide-in-from-left-3 duration-200";

  function goToStep(next: CreationStep, direction: "forward" | "backward") {
    setTransitionDirection(direction);
    setStep(next);
  }

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
      goToStep("crop", "forward");
      queryClient.invalidateQueries({ queryKey: ["media"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao enviar imagem."),
  });

  const media = useMemo(() => mediaQuery.data ?? [], [mediaQuery.data]);
  const selected = useMemo(() => media.find((m) => m.id === selectedMediaId) ?? null, [media, selectedMediaId]);

  function confirmLibraryPick() {
    setLibraryDialogOpen(false);
  }

  function handleAdvance() {
    if (step === "select") goToStep("crop", "forward");
    else if (step === "crop") goToStep("create", "forward");
  }

  function handleBack() {
    if (step === "crop") {
      setDiscardDialogOpen(true);
      return;
    } else if (step === "create") {
      goToStep("crop", "backward");
    }
  }

  function discardAndRestart() {
    setTitle("");
    setCaption("");
    setTags([]);
    setSelectedMediaId(null);
    setPickedMediaId(null);
    setScheduledAtUtc(null);
    setPreviewAspect("1:1");
    setCropData(null);
    setScheduleModalOpen(false);
    goToStep("select", "backward");
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

    setSavingAction(asDraft ? "draft" : "schedule");
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
      if (canManageApproval) {
        body.directSchedule = true;
      }
    }

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        toast.error(getErrorMessage(payload) ?? "Falha ao criar post.");
        return;
      }

      if (asDraft) {
        toast.success("Rascunho salvo.");
      } else if (canManageApproval) {
        toast.success("Post agendado.");
      } else {
        toast.success("Post enviado para aprovação.");
      }
      router.replace("/app/posts");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar post.");
    } finally {
      setSavingAction(null);
    }
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
      <div className="flex justify-center">
        {step === "create" ? (
          <div key="create" className={cn("w-full max-w-[1060px]", transitionClass)}>
            <Card className="mb-3 px-3 py-1.5">
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
              savingAction={savingAction}
              onSaveDraft={() => void savePost(true)}
              onSchedulePost={() => void savePost(false)}
              primaryActionLabel={canManageApproval ? "Agendar post" : "Enviar para aprovação"}
              primaryActionHint={
                canManageApproval
                  ? "Será publicado automaticamente no horário definido."
                  : "Será enviado para aprovação e só será agendado após aprovação."
              }
            />
          </div>
        ) : (
          <Card key={step} className={cn("flex w-[732px] max-w-[calc(100vw-2rem)] shrink-0 flex-col overflow-hidden p-4", transitionClass)}>
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
                onSelectMedia={(id) => {
                  setSelectedMediaId(id);
                  goToStep("crop", "forward");
                }}
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
                cropData={cropData}
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

      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar e recomeçar?</AlertDialogTitle>
            <AlertDialogDescription>
              Voltar para a seleção de mídia vai descartar o post em criação. Você precisará começar novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                discardAndRestart();
                setDiscardDialogOpen(false);
              }}
            >
              Descartar e recomeçar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}



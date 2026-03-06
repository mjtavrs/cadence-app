"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { PostPreviewCrop, type PreviewAspectRatio, type CropData } from "@/components/posts/post-preview-crop";
import { PostInfoPanel } from "@/components/posts/create/post-info-panel";

export function StepCreatePost(props: {
  imageSrc: string | null;
  imageAlt?: string;
  aspectRatio: PreviewAspectRatio;
  cropData: CropData | null;
  title: string;
  onTitleChange: (v: string) => void;
  tags: string[];
  onTagsChange: (v: string[]) => void;
  caption: string;
  onCaptionChange: (v: string) => void;
  scheduledAtUtc: string | null;
  onOpenSchedule: () => void;
  savingAction: "draft" | "schedule" | null;
  onSaveDraft: () => void;
  onSchedulePost: () => void;
  primaryActionLabel?: string;
  primaryActionHint?: string;
}) {
  const [panelVisible, setPanelVisible] = useState(false);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setPanelVisible(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="w-full min-w-0 max-w-[700px] flex-1">
        <div>
          <PostPreviewCrop
            imageSrc={props.imageSrc}
            imageAlt={props.imageAlt}
            aspectRatio={props.aspectRatio}
            cropData={props.cropData}
            showAspectRatioControl={false}
            emptyPlaceholder="Nenhuma imagem selecionada"
          />
        </div>
      </div>

      <Card
        className={`w-[340px] shrink-0 p-4 h-fit transition-all duration-300 ease-out ${
          panelVisible
            ? "translate-x-0 opacity-100"
            : "translate-x-4 opacity-0"
        }`}
      >
        <PostInfoPanel
          title={props.title}
          onTitleChange={props.onTitleChange}
          tags={props.tags}
          onTagsChange={props.onTagsChange}
          caption={props.caption}
          onCaptionChange={props.onCaptionChange}
          scheduledAtUtc={props.scheduledAtUtc}
          onOpenSchedule={props.onOpenSchedule}
          savingAction={props.savingAction}
          onSaveDraft={props.onSaveDraft}
          onSchedulePost={props.onSchedulePost}
          primaryActionLabel={props.primaryActionLabel}
          primaryActionHint={props.primaryActionHint}
        />
      </Card>
    </div>
  );
}

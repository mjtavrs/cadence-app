"use client";

import { PostPreviewCrop, type PreviewAspectRatio, type CropData } from "@/components/posts/post-preview-crop";

export function StepCropAdjust(props: {
  imageSrc: string | null;
  imageAlt?: string;
  aspectRatio: PreviewAspectRatio;
  onAspectRatioChange: (value: PreviewAspectRatio) => void;
  onCropChange: (crop: CropData) => void;
}) {
  return (
    <div className="flex flex-col items-center p-4">
      <div className="w-full min-w-0" style={{ maxWidth: 700 }}>
        <PostPreviewCrop
          imageSrc={props.imageSrc}
          imageAlt={props.imageAlt}
          aspectRatio={props.aspectRatio}
          onAspectRatioChange={props.onAspectRatioChange}
          onCropChange={props.onCropChange}
          emptyPlaceholder="Nenhuma imagem selecionada"
        />
      </div>
    </div>
  );
}

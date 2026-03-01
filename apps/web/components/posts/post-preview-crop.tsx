"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { RatioIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const PREVIEW_SIZE_MAX = 700;

export type PreviewAspectRatio = "original" | "1:1" | "4:5" | "16:9";

export type CropData = {
  aspectRatio: PreviewAspectRatio;
  cropX: number; // 0-1 (posição X relativa do centro da área cropada)
  cropY: number; // 0-1 (posição Y relativa do centro da área cropada)
};

const ASPECT_OPTIONS: { value: PreviewAspectRatio; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
  { value: "16:9", label: "16:9" },
];

function getFrameSize(
  aspect: PreviewAspectRatio,
  naturalWidth: number,
  naturalHeight: number,
  viewportSize: number
): { width: number; height: number } {
  const max = viewportSize;
  switch (aspect) {
    case "1:1": {
      if (naturalWidth <= 0 || naturalHeight <= 0) return { width: max, height: max };
      if (naturalWidth <= viewportSize && naturalHeight <= viewportSize) return { width: max, height: max };
      const scale = Math.max(viewportSize / naturalWidth, viewportSize / naturalHeight);
      return {
        width: Math.round(naturalWidth * scale),
        height: Math.round(naturalHeight * scale),
      };
    }
    case "4:5":
      return { width: max, height: Math.round(max * (5 / 4)) };
    case "16:9":
      return { width: Math.round(max * (16 / 9)), height: max };
    case "original": {
      if (naturalWidth <= 0 || naturalHeight <= 0) return { width: max, height: max };
      const r = naturalWidth / naturalHeight;
      if (r >= 1) return { width: max, height: Math.round(max / r) };
      return { width: Math.round(max * r), height: max };
    }
  }
}

function clampPan(pan: number, frameSize: number, viewportSize: number): number {
  const overflow = Math.max(0, frameSize - viewportSize);
  const half = overflow / 2;
  return Math.max(-half, Math.min(half, pan));
}

export function PostPreviewCrop(props: {
  imageSrc: string | null;
  imageAlt?: string;
  aspectRatio: PreviewAspectRatio;
  onAspectRatioChange?: (value: PreviewAspectRatio) => void;
  onCropChange?: (crop: CropData) => void;
  emptyPlaceholder?: string;
  onEmptyAreaClick?: () => void;
  isLoading?: boolean;
  className?: string;
  showAspectRatioControl?: boolean;
}) {
  const {
    imageSrc,
    imageAlt,
    aspectRatio,
    onAspectRatioChange,
    onCropChange,
    emptyPlaceholder,
    onEmptyAreaClick,
    isLoading,
    className,
    showAspectRatioControl = true,
  } = props;
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [viewportSize, setViewportSize] = useState(PREVIEW_SIZE_MAX);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const lastCropRef = useRef<CropData | null>(null);
  const onCropChangeRef = useRef(onCropChange);

  // Atualizar ref quando onCropChange mudar
  useEffect(() => {
    onCropChangeRef.current = onCropChange;
  }, [onCropChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0]?.contentRect ?? { width: PREVIEW_SIZE_MAX };
      const size = Math.min(PREVIEW_SIZE_MAX, Math.max(200, Math.round(width)));
      setViewportSize(size);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const frameSize = getFrameSize(aspectRatio, naturalSize.width, naturalSize.height, viewportSize);
  const overflowX = Math.max(0, frameSize.width - viewportSize);
  const overflowY = Math.max(0, frameSize.height - viewportSize);
  const canPan = overflowX > 0 || overflowY > 0;
  const useContain1_1 =
    aspectRatio === "1:1" &&
    naturalSize.width > 0 &&
    naturalSize.height > 0 &&
    naturalSize.width <= viewportSize &&
    naturalSize.height <= viewportSize;

  useEffect(() => {
    if (!canPan) {
      setPanX(0);
      setPanY(0);
    } else {
      setPanX((p) => clampPan(p, frameSize.width, viewportSize));
      setPanY((p) => clampPan(p, frameSize.height, viewportSize));
    }
  }, [aspectRatio, canPan, frameSize.width, frameSize.height, viewportSize]);

  // Calcular coordenadas de crop e notificar mudanças
  useEffect(() => {
    if (!onCropChangeRef.current || !imageSrc) return;
    
    let newCrop: CropData;
    
    // Se a imagem ainda não carregou ou não há tamanho natural, usar centro como padrão
    if (naturalSize.width === 0 || naturalSize.height === 0) {
      newCrop = {
        aspectRatio,
        cropX: 0.5,
        cropY: 0.5,
      };
    }
    // Se não pode fazer pan (sem overflow), usar centro
    else if (!canPan || (overflowX === 0 && overflowY === 0)) {
      newCrop = {
        aspectRatio,
        cropX: 0.5,
        cropY: 0.5,
      };
    }
    // Calcular crop baseado em panX/panY
    else {
      const maxPanX = overflowX > 0 ? overflowX / 2 : 0;
      const maxPanY = overflowY > 0 ? overflowY / 2 : 0;
      
      // Normalizar panX/panY para -1 a 1 (onde 0 = centro)
      const normalizedX = maxPanX > 0 && Math.abs(maxPanX) > 0.001 ? panX / maxPanX : 0;
      const normalizedY = maxPanY > 0 && Math.abs(maxPanY) > 0.001 ? panY / maxPanY : 0;
      
      // Garantir que normalizedX/Y são números válidos
      const safeNormalizedX = Number.isFinite(normalizedX) ? normalizedX : 0;
      const safeNormalizedY = Number.isFinite(normalizedY) ? normalizedY : 0;
      
      const cropX = 0.5 - safeNormalizedX * 0.5;
      const cropY = 0.5 - safeNormalizedY * 0.5;

      newCrop = {
        aspectRatio,
        cropX: Math.max(0, Math.min(1, cropX)),
        cropY: Math.max(0, Math.min(1, cropY)),
      };
    }

    // Só chamar onCropChange se o valor realmente mudou
    const lastCrop = lastCropRef.current;
    if (
      !lastCrop ||
      lastCrop.aspectRatio !== newCrop.aspectRatio ||
      Math.abs(lastCrop.cropX - newCrop.cropX) > 0.001 ||
      Math.abs(lastCrop.cropY - newCrop.cropY) > 0.001
    ) {
      lastCropRef.current = newCrop;
      onCropChangeRef.current(newCrop);
    }
  }, [panX, panY, aspectRatio, overflowX, overflowY, canPan, imageSrc, naturalSize.width, naturalSize.height]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canPan || !imageSrc) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX, panY };
    },
    [canPan, imageSrc, panX, panY]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPanX((p) => clampPan(dragStart.current.panX + dx, frameSize.width, viewportSize));
      setPanY((p) => clampPan(dragStart.current.panY + dy, frameSize.height, viewportSize));
    },
    [dragging, frameSize.width, frameSize.height, viewportSize]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <div className={cn("flex w-full min-w-0 max-w-[700px] flex-col", className)}>
      <div
        ref={containerRef}
        className="bg-muted relative w-full shrink-0 overflow-hidden rounded-md"
        style={{ aspectRatio: "1 / 1" }}
      >
        {isLoading ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/80">
            <Spinner className="size-8 text-primary" />
            <span className="text-muted-foreground text-sm">Carregando...</span>
          </div>
        ) : imageSrc ? (
          <>
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 origin-center"
              style={{
                width: frameSize.width,
                height: frameSize.height,
                transform: `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px))`,
              }}
              aria-hidden
            >
              <img
                src={imageSrc}
                alt={imageAlt ?? "Prévia"}
                className={cn("h-full w-full select-none", useContain1_1 ? "object-contain" : "object-cover")}
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                }}
              />
            </div>
            <div
              role="presentation"
              className={cn(
                "absolute inset-0 z-10 touch-none",
                canPan && "cursor-grab active:cursor-grabbing"
              )}
              style={{ touchAction: "none" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            {showAspectRatioControl ? (
            <div className="absolute bottom-2 left-2 z-20">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2 shadow-md">
                    <RatioIcon className="size-4" />
                    {ASPECT_OPTIONS.find((o) => o.value === aspectRatio)?.label ?? "Proporção"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                  <DropdownMenuRadioGroup value={aspectRatio} onValueChange={(v) => onAspectRatioChange?.(v as PreviewAspectRatio)}>
                    {ASPECT_OPTIONS.map((opt) => (
                      <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted/50 flex h-full w-full cursor-pointer items-center justify-center rounded-none text-center text-sm transition-colors"
            onClick={onEmptyAreaClick}
          >
            {emptyPlaceholder ?? "Selecione uma imagem"}
          </button>
        )}
      </div>
    </div>
  );
}

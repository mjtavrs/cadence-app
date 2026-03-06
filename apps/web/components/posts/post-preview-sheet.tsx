"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PostStatusBadge, type PostStatus } from "@/components/posts/post-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CiMobile3, CiDesktop } from "react-icons/ci";
import { SlOptions } from "react-icons/sl";
import { TbRepeat } from "react-icons/tb";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { formatDateAndTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const nextStatusButtonLabels: Partial<Record<PostStatus, string>> = {
  DRAFT: "Enviar para aprovação",
  IN_REVIEW: "Aprovar",
  APPROVED: "Agendar",
  SCHEDULED: "Cancelar agendamento",
  FAILED: "Reagendar (+2 min)",
};

function getNextStatusButtonLabel(status: PostStatus): string {
  return nextStatusButtonLabels[status] ?? "Mudar para próximo estado";
}

type PostPreviewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: {
    postId: string;
    title?: string;
    status: PostStatus;
    caption: string;
    tags?: string[];
    scheduledAtUtc?: string;
    mediaIds: string[];
    aspectRatio?: "original" | "1:1" | "4:5" | "16:9";
    cropX?: number;
    cropY?: number;
  };
  onEdit?: () => void;
  onNextStatus?: () => void;
  nextStatusLabel?: string;
};

type MediaItem = {
  id: string;
  url: string;
  contentType: string;
  fileName: string | null;
};

async function loadMedia() {
  const res = await fetch("/api/media", { cache: "no-store" });
  const payload = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new Error("Falha ao carregar mídias.");
  const data = payload as { items?: MediaItem[] };
  return data.items ?? [];
}

export function PostPreviewSheet(props: PostPreviewSheetProps) {
  const { open, onOpenChange, post } = props;
  const [viewMode, setViewMode] = useState<"mobile" | "desktop">("mobile");
  const [captionExpanded, setCaptionExpanded] = useState(false);

  const mediaQuery = useQuery({
    queryKey: ["media"],
    queryFn: loadMedia,
    enabled: open && post.mediaIds.length > 0,
    staleTime: 30_000,
  });

  const mediaItem = post.mediaIds.length > 0
    ? mediaQuery.data?.find((m) => m.id === post.mediaIds[0])
    : null;

  const firstLine = post.caption.split("\n")[0];
  const captionOneLine = firstLine.length > 80 ? `${firstLine.slice(0, 80)}` : firstLine;
  const needsTruncate = post.caption.length > 80 || post.caption.includes("\n");
  const isOriginalAspect = (post.aspectRatio ?? "1:1") === "original";

  function getAspectRatioClass(): string {
    const ratio = post.aspectRatio ?? "1:1";
    switch (ratio) {
      case "1:1":
        return "aspect-square";
      case "4:5":
        return "aspect-[4/5]";
      case "16:9":
        return "aspect-video";
      case "original":
      default:
        return "aspect-auto";
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <SheetTitle className="text-lg  text-zinc-600">{post.title || "Sem título"}</SheetTitle>
              <PostStatusBadge status={post.status} />
            </div>
            <div className="flex items-center justify-center gap-2">
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => {
                  if (v === "mobile" || v === "desktop") setViewMode(v);
                }}
                variant="outline"
                size="sm"
                spacing={0}
                aria-label="Alternar visão mobile ou desktop"
              >
                <ToggleGroupItem value="mobile" className="data-[state=off]:cursor-pointer hover:bg-muted! data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                  <CiMobile3 className="size-4" />
                  Mobile
                </ToggleGroupItem>
                <ToggleGroupItem value="desktop" className="data-[state=off]:cursor-pointer hover:bg-muted! data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                  <CiDesktop className="size-4" />
                  Desktop
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col">
          {/* Preview estilo Instagram */}
          <div className="border border-zinc-200 rounded-lg m-2 bg-white">
            {/* Topo: Avatar + Nome [+ Tempo só desktop] + Opções */}
            <div className="mb-2 flex items-center justify-between px-7 pt-4">
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  <AvatarFallback>MA</AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">maribe.arquitetura</span>
                  {viewMode === "desktop" && (
                    <span className="text-muted-foreground text-xs">• 22 h</span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="size-8">
                <SlOptions className="size-4" />
              </Button>
            </div>

            {/* Imagem */}
            {post.mediaIds && post.mediaIds.length > 0 && (
              <div className="mb-3 w-full px-4">
                {mediaQuery.isLoading ? (
                  <div className={`w-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center rounded-lg ${getAspectRatioClass()}`}>
                    <span className="text-muted-foreground text-sm">Carregando...</span>
                  </div>
                ) : mediaItem ? (
                  <div
                    className={cn(
                      "w-full overflow-hidden rounded-lg",
                      getAspectRatioClass(),
                      isOriginalAspect ? "bg-white" : "",
                    )}
                  >
                    <img
                      src={mediaItem.url}
                      alt={mediaItem.fileName ?? "Preview"}
                      className={cn(
                        "w-full",
                        isOriginalAspect ? "h-auto object-contain" : "h-full object-cover",
                      )}
                      style={{
                        objectPosition: `${(post.cropX ?? 0.5) * 100}% ${(post.cropY ?? 0.5) * 100}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div className={`w-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center rounded-lg ${getAspectRatioClass()}`}>
                    <span className="text-muted-foreground text-sm">Imagem não encontrada</span>
                  </div>
                )}
              </div>
            )}

            {/* Botões de ação Instagram */}
            <div className="mb-2 flex items-center justify-between px-7">
              <div className="flex items-center gap-2">
                <button type="button" className="flex items-center gap-1.5 text-foreground" aria-label="Curtir">
                  <svg aria-label="Curtir" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
                    <title>Curtir</title>
                    <path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938m0-2a6.04 6.04 0 0 0-4.797 2.127 6.052 6.052 0 0 0-4.787-2.127A6.985 6.985 0 0 0 .5 9.122c0 3.61 2.55 5.827 5.015 7.97.283.246.569.494.853.747l1.027.918a44.998 44.998 0 0 0 3.518 3.018 2 2 0 0 0 2.174 0 45.263 45.263 0 0 0 3.626-3.115l.922-.824c.293-.26.59-.519.885-.774 2.334-2.025 4.98-4.32 4.98-7.94a6.985 6.985 0 0 0-6.708-7.218Z" />
                  </svg>
                  <span className="text-sm font-semibold">227</span>
                </button>
                <button type="button" className="flex items-center gap-1.5 text-foreground" aria-label="Comentar">
                  <svg aria-label="Comentar" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
                    <title>Comentar</title>
                    <path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                  <span className="text-sm font-semibold">13</span>
                </button>
                {viewMode === "mobile" && (
                  <button type="button" className="flex items-center gap-1.5 text-foreground" aria-label="Repostar">
                    <TbRepeat className="size-6 shrink-0" aria-hidden />
                    <span className="text-sm font-semibold">8</span>
                  </button>
                )}
                <button type="button" className={cn("text-foreground", viewMode === "mobile" ? "flex items-center gap-1.5" : "")} aria-label="Compartilhar">
                  <svg aria-label="Compartilhar" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
                    <title>Compartilhar</title>
                    <path d="M13.973 20.046 21.77 6.928C22.8 5.195 21.55 3 19.535 3H4.466C2.138 3 .984 5.825 2.646 7.456l4.842 4.752 1.723 7.121c.548 2.266 3.571 2.721 4.762.717Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
                    <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="7.488" x2="15.515" y1="12.208" y2="7.641" />
                  </svg>
                  {viewMode === "mobile" && <span className="text-sm font-semibold">10</span>}
                </button>
              </div>
              <button type="button" className="text-foreground" aria-label="Salvar">
                <svg aria-label="Salvar" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
                  <title>Salvar</title>
                  <polygon fill="none" points="20 21 12 13.44 4 21 4 3 20 3 20 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </div>

            {/* Legenda: uma linha + "mais" / expandido + "menos" */}
            <div className="px-7 pb-4">
              {captionExpanded ? (
                <p className="text-sm">
                  <span className="font-semibold">maribe.arquitetura</span>{" "}
                  {post.caption}
                    {needsTruncate && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() => setCaptionExpanded(false)}
                        className="text-muted-foreground hover:underline"
                      >
                        menos
                      </button>
                    </>
                  )}
                </p>
              ) : (
                <div className="flex items-baseline gap-1 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">maribe.arquitetura</span>{" "}
                    {needsTruncate ? captionOneLine : firstLine}
                    {needsTruncate && <span className="text-muted-foreground">...</span>}
                  </span>
                  {needsTruncate && (
                    <button
                      type="button"
                      onClick={() => setCaptionExpanded(true)}
                      className="shrink-0 text-muted-foreground hover:underline"
                    >
                      mais
                    </button>
                  )}
                </div>
              )}
              {viewMode === "mobile" && (
                <p className="text-muted-foreground mt-1 text-xs">22 horas atrás</p>
              )}
            </div>
          </div>

          {/* Informações extras */}
          <div className="border-t space-y-4 mt-6 p-4">
            <div>
                <h4 className="mb-2 text-sm font-medium">Ações rápidas</h4>
                <div className="flex gap-1.5">
                  {props.onEdit && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/posts/${encodeURIComponent(post.postId)}`}>
                        <Pencil className="size-4" />
                        Editar
                      </Link>
                    </Button>
                  )}
                  {props.onNextStatus && (
                    <Button size="sm" onClick={props.onNextStatus}>
                      {props.nextStatusLabel ?? getNextStatusButtonLabel(post.status)}
                    </Button>
                  )}
                </div>
            </div>
            {post.scheduledAtUtc && (
              <div>
                <h4 className="mb-1 text-sm font-medium">Agendamento</h4>
                <p className="text-muted-foreground text-sm">{formatDateAndTime(post.scheduledAtUtc)}</p>
              </div>
            )}
            {post.tags && post.tags.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Tags</h4>
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((t) => (
                    <Badge key={t} variant="outline">
                      #{t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

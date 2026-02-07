"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Page, PageActions, PageDescription, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";
import { TagsInput } from "@/components/posts/tags-input";

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
};

function normalizeTitle(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

function normalizeCaption(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

export function EditPostClient(props: { initialPost: EditablePost; initialMedia: MediaItem[] }) {
  const router = useRouter();

  const [title, setTitle] = useState(props.initialPost.title ?? "");
  const [caption, setCaption] = useState(props.initialPost.caption ?? "");
  const [tags, setTags] = useState<string[]>(props.initialPost.tags ?? []);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(props.initialPost.mediaIds?.[0] ?? null);
  const [saving, setSaving] = useState(false);

  const normalizedTitle = useMemo(() => normalizeTitle(title), [title]);
  const normalizedCaption = useMemo(() => normalizeCaption(caption), [caption]);

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
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(props.initialPost.postId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: normalizedTitle,
          caption: normalizedCaption,
          tags,
          mediaIds: [selectedMediaId],
        }),
      });

      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const v = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
        throw new Error(typeof v?.message === "string" ? v.message : "Falha ao salvar post.");
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
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Título</div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Tags</div>
              <TagsInput value={tags} onChange={setTags} />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Legenda</div>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} />
              <div className="text-muted-foreground text-xs">
                {normalizedCaption.length ? `${normalizedCaption.length} caractere(s)` : "Vazio"}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium">Imagem</div>
          {props.initialMedia.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">Nenhuma mídia disponível.</p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {props.initialMedia.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`relative aspect-square overflow-hidden rounded border ${
                    selectedMediaId === m.id ? "border-primary" : "border-border"
                  }`}
                  onClick={() => setSelectedMediaId(m.id)}
                  title={m.fileName ?? m.id}
                >
                  <img src={m.url} alt={m.fileName ?? "mídia"} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}


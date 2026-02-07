"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Page, PageActions, PageDescription, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";
import { TagsInput } from "@/components/posts/tags-input";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export default function NewPostPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const media = useMemo(() => mediaQuery.data ?? [], [mediaQuery.data]);
  const selected = useMemo(() => media.find((m) => m.id === selectedMediaId) ?? null, [media, selectedMediaId]);

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
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: normalizedTitle, caption: normalizedCaption, tags, mediaIds: [selectedMediaId] }),
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

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3 text-sm font-medium">Prévia</div>
          <div className="bg-muted relative aspect-square">
            {selected ? (
              <img
                src={selected.url}
                alt={selected.fileName ?? "Prévia"}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
                Selecione uma imagem
              </div>
            )}
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Imagem</div>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/app/media">Abrir biblioteca</Link>
              </Button>
            </div>

            {mediaQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : media.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma mídia disponível.</p>
            ) : (
              <ScrollArea className="h-44">
                <div className="grid grid-cols-5 gap-2 pr-2">
                  {media.map((m) => (
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
              </ScrollArea>
            )}
          </div>
        </Card>

        <Card className="p-4">
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

            <Button className="w-full" disabled={saving} onClick={() => void save()}>
              {saving ? "Salvando..." : "Criar post"}
            </Button>
          </div>
        </Card>
      </div>
    </Page>
  );
}


"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

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

  const [caption, setCaption] = useState("");
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const media = mediaQuery.data ?? [];

  async function save() {
    setError(null);

    if (!normalizedCaption) {
      setError("A legenda não pode estar vazia.");
      return;
    }
    if (!selectedMediaId) {
      setError("Selecione uma imagem.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ caption: normalizedCaption, mediaIds: [selectedMediaId] }),
    });
    const payload = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      setError(getErrorMessage(payload) ?? "Falha ao criar post.");
      setSaving(false);
      return;
    }
    setSaving(false);
    router.replace("/app/posts");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Novo post</h1>
        <p className="text-muted-foreground text-sm">No MVP, cada post tem 1 imagem + legenda.</p>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Legenda</div>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} />
            <div className="text-muted-foreground text-xs">
              {normalizedCaption.length ? `${normalizedCaption.length} caractere(s)` : "Vazio"}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
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
            <div className="grid grid-cols-3 gap-2">
              {media.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`relative aspect-square overflow-hidden rounded border ${
                    selectedMediaId === m.id ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-200 dark:border-zinc-800"
                  }`}
                  onClick={() => setSelectedMediaId(m.id)}
                  title={m.fileName ?? m.id}
                >
                  <img src={m.url} alt={m.fileName ?? "mídia"} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-4">
            <Button className="w-full" disabled={saving} onClick={() => save()}>
              {saving ? "Salvando..." : "Criar post"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}


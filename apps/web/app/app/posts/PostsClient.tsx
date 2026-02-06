"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

type PostStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED";

export type Post = {
  postId: string;
  status: PostStatus;
  caption: string;
  mediaIds: string[];
  scheduledAtUtc?: string;
  updatedAt: string;
};

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

export function PostsClient(props: { initialItems: Post[] }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  type ListResponse = { items: Post[] };

  async function loadPosts() {
    const res = await fetch("/api/posts", { cache: "no-store" });
    const payload = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao listar posts.");
    return ((payload as ListResponse | null)?.items ?? []) as Post[];
  }

  const postsQuery = useQuery({
    queryKey: ["posts"],
    queryFn: loadPosts,
    initialData: props.initialItems,
    staleTime: 15_000,
  });

  const items = postsQuery.data ?? [];
  const isBusy = useMemo(() => postsQuery.isFetching, [postsQuery.isFetching]);

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: ["posts"] });

  const actionMutation = useMutation({
    mutationFn: async (params: { postId: string; action: "submit" | "approve" | "cancel" }) => {
      const res = await fetch(`/api/posts/${encodeURIComponent(params.postId)}/${params.action}`, { method: "POST" });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao executar ação.");
    },
    onSuccess: invalidate,
  });

  const scheduleMutation = useMutation({
    mutationFn: async (params: { postId: string; scheduledAtUtc: string }) => {
      const res = await fetch(`/api/posts/${encodeURIComponent(params.postId)}/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheduledAtUtc: params.scheduledAtUtc }),
      });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao agendar post.");
    },
    onSuccess: invalidate,
  });

  async function action(postId: string, actionName: "submit" | "approve" | "cancel") {
    setError(null);
    try {
      await actionMutation.mutateAsync({ postId, action: actionName });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao executar ação.");
    }
  }

  async function schedule(postId: string) {
    setError(null);
    const value = prompt("Agendar para (UTC ISO). Ex: 2026-02-06T12:30:00.000Z");
    if (!value) return;
    try {
      await scheduleMutation.mutateAsync({ postId, scheduledAtUtc: value });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao agendar post.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
          <p className="text-muted-foreground text-sm">
            Workflow editorial: DRAFT → IN_REVIEW → APPROVED → SCHEDULED.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/posts/new">Novo post</Link>
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {postsQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nenhum post ainda</EmptyTitle>
            <EmptyDescription>Crie seu primeiro post para começar o calendário.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/app/posts/new">Criar post</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4">
          {items.map((p) => (
            <Card key={p.postId} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{p.status}</span>
                    {p.scheduledAtUtc && (
                      <span className="text-muted-foreground text-xs">{p.scheduledAtUtc}</span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm text-zinc-900 dark:text-zinc-50">{p.caption}</p>
                  <div className="text-muted-foreground text-xs">
                    {p.mediaIds?.length ? `mídia: ${p.mediaIds[0]}` : "sem mídia"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/app/posts/${encodeURIComponent(p.postId)}`}>Editar</Link>
                  </Button>
                  {p.status === "DRAFT" && (
                    <Button size="sm" disabled={isBusy} onClick={() => action(p.postId, "submit")}>
                      Enviar para review
                    </Button>
                  )}
                  {p.status === "IN_REVIEW" && (
                    <Button size="sm" disabled={isBusy} onClick={() => action(p.postId, "approve")}>
                      Aprovar
                    </Button>
                  )}
                  {p.status === "APPROVED" && (
                    <Button size="sm" disabled={isBusy} onClick={() => schedule(p.postId)}>
                      Agendar
                    </Button>
                  )}
                  {p.status === "SCHEDULED" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => action(p.postId, "cancel")}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


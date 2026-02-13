"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { SchedulePostDialog } from "@/components/posts/schedule-post-dialog";
import { getNextQuarterSlotInTimeZone, formatDateForSection } from "@/lib/datetime";
import { PostCard, type PostListItem, type PostStatus } from "@/components/posts/post-card";
import { PostsFiltersBar } from "@/components/posts/posts-filters-bar";
import { PostPreviewSheet } from "@/components/posts/post-preview-sheet";

export type Post = {
  postId: string;
  status: PostStatus;
  title?: string;
  shortCode?: string;
  tags?: string[];
  caption: string;
  mediaIds: string[];
  scheduledAtUtc?: string;
  updatedAt: string;
  aspectRatio?: "original" | "1:1" | "4:5" | "16:9";
  cropX?: number;
  cropY?: number;
};

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

export function PostsClient(props: { initialItems: Post[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [schedulePostId, setSchedulePostId] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleKey, setScheduleKey] = useState(0);
  const [scheduleDefaultDate, setScheduleDefaultDate] = useState<Date>(() => new Date());
  const [scheduleDefaultTime, setScheduleDefaultTime] = useState<string>(() => "00:00");

  const [statusFilter, setStatusFilter] = useState<"ALL" | PostStatus>("ALL");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [previewPostId, setPreviewPostId] = useState<string | null>(null);

  type ListResponse = { items: Post[] };

  async function loadPosts() {
    const url = new URL("/api/posts", window.location.origin);
    if (statusFilter !== "ALL") url.searchParams.set("status", statusFilter);
    const res = await fetch(url, { cache: "no-store" });
    const payload = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao listar posts.");
    return ((payload as ListResponse | null)?.items ?? []) as Post[];
  }

  const postsQuery = useQuery({
    queryKey: ["posts", statusFilter],
    queryFn: loadPosts,
    initialData: statusFilter === "ALL" ? props.initialItems : undefined,
    staleTime: 15_000,
  });

  const filteredItems = useMemo(() => {
    const fetchedItems = postsQuery.data ?? [];
    if (!tagFilters.length) return fetchedItems;
    return fetchedItems.filter((p) => {
      const tags = (p.tags ?? []).map((t) => t.toLowerCase());
      return tagFilters.some((t) => tags.includes(t.toLowerCase()));
    });
  }, [postsQuery.data, tagFilters]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, Post[]>();
    for (const post of filteredItems) {
      const dateKey = post.scheduledAtUtc ? formatDateForSection(post.scheduledAtUtc) : "Sem agendamento";
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(post);
    }
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "Hoje") return -1;
      if (b[0] === "Hoje") return 1;
      if (a[0] === "Amanhã") return -1;
      if (b[0] === "Amanhã") return 1;
      if (a[0] === "Sem agendamento") return 1;
      if (b[0] === "Sem agendamento") return -1;
      return b[0].localeCompare(a[0], "pt-BR");
    });
    for (const [, posts] of sortedGroups) {
      posts.sort((a, b) => {
        const aTime = a.scheduledAtUtc ? new Date(a.scheduledAtUtc).getTime() : 0;
        const bTime = b.scheduledAtUtc ? new Date(b.scheduledAtUtc).getTime() : 0;
        return bTime - aTime;
      });
    }
    return sortedGroups;
  }, [filteredItems]);

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

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao deletar post.");
    },
    onSuccess: invalidate,
  });

  const duplicateMutation = useMutation({
    mutationFn: async (post: Post) => {
      const body: Record<string, unknown> = {
        title: post.title,
        caption: post.caption,
        tags: post.tags ?? [],
        mediaIds: post.mediaIds,
        scheduledAtUtc: post.scheduledAtUtc,
        aspectRatio: post.aspectRatio ?? "1:1",
        cropX: post.cropX ?? 0.5,
        cropY: post.cropY ?? 0.5,
      };
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao duplicar post.");
      return payload as { postId?: string };
    },
    onSuccess: async (data) => {
      await invalidate();
      if (data.postId) {
        toast.success("Post duplicado.");
        router.push(`/app/posts/${encodeURIComponent(data.postId)}`);
      }
    },
  });

  async function action(postId: string, actionName: "submit" | "approve" | "cancel") {
    try {
      await actionMutation.mutateAsync({ postId, action: actionName });
      const msg =
        actionName === "submit"
          ? "Post enviado para review."
          : actionName === "approve"
            ? "Post aprovado."
            : "Agendamento cancelado.";
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao executar ação.");
    }
  }

  function openSchedule(postId: string) {
    const next = getNextQuarterSlotInTimeZone(new Date(), "America/Recife");
    setScheduleDefaultDate(next.dateForCalendar);
    setScheduleDefaultTime(next.time);
    setScheduleKey((k) => k + 1);
    setSchedulePostId(postId);
    setScheduleOpen(true);
  }

  async function confirmSchedule(postId: string, scheduledAtUtc: string) {
    await scheduleMutation.mutateAsync({ postId, scheduledAtUtc });
  }

  async function deletePost(postId: string) {
    try {
      await deleteMutation.mutateAsync(postId);
      toast.success("Post deletado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao deletar post.");
    }
  }

  return (
    <div className="space-y-4">
      <SchedulePostDialog
        key={scheduleKey}
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) setSchedulePostId(null);
        }}
        isSubmitting={scheduleMutation.isPending}
        onConfirm={confirmSchedule}
        postId={schedulePostId}
        defaultDate={scheduleDefaultDate}
        defaultTimeHHmm={scheduleDefaultTime}
      />

      <PostsFiltersBar
        status={statusFilter}
        onStatusChange={setStatusFilter}
        tags={tagFilters}
        onTagsChange={setTagFilters}
        onResolveCode={async (code) => {
          const res = await fetch(`/api/posts/resolve?code=${encodeURIComponent(code)}`);
          const payload = (await res.json().catch(() => null)) as unknown;
          const value = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
          if (!res.ok) {
            throw new Error(typeof value?.message === "string" ? value.message : "Código não encontrado.");
          }
          const postId = typeof value?.postId === "string" ? value.postId : undefined;
          if (!postId) throw new Error("Código não encontrado.");
          router.push(`/app/posts/${encodeURIComponent(postId)}`);
        }}
      />

      {postsQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : filteredItems.length === 0 ? (
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
        <div className="space-y-6">
          {groupedItems.map(([dateLabel, posts]) => (
            <div key={dateLabel} className="space-y-4">
              <h2 className="text-lg font-semibold">{dateLabel}</h2>
              <div className="grid gap-4">
                {posts.map((p) => {
                  const previewPost = previewPostId === p.postId ? p : null;
                  return (
                    <div key={p.postId}>
                      <PostCard
                        item={p as unknown as PostListItem}
                        isBusy={isBusy || deleteMutation.isPending || duplicateMutation.isPending}
                        onSubmit={() => void action(p.postId, "submit")}
                        onApprove={() => void action(p.postId, "approve")}
                        onSchedule={() => openSchedule(p.postId)}
                        onCancel={() => void action(p.postId, "cancel")}
                        onDelete={() => void deletePost(p.postId)}
                        onPreview={() => setPreviewPostId(p.postId)}
                        onDuplicate={() => {
                          duplicateMutation.mutate(p);
                        }}
                        onCaptionMore={() => setPreviewPostId(p.postId)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewPostId && (() => {
        const foundPost = filteredItems.find((p) => p.postId === previewPostId);
        return (
          <PostPreviewSheet
            open={!!previewPostId}
            onOpenChange={(open) => !open && setPreviewPostId(null)}
            post={
              foundPost ?? {
                postId: previewPostId,
                status: "DRAFT",
                caption: "",
                mediaIds: [],
                aspectRatio: "1:1",
                cropX: 0.5,
                cropY: 0.5,
              }
            }
          onEdit={() => {
            setPreviewPostId(null);
            router.push(`/app/posts/${encodeURIComponent(previewPostId)}`);
          }}
          onNextStatus={() => {
            const post = filteredItems.find((p) => p.postId === previewPostId);
            if (!post) return;
            if (post.status === "DRAFT") void action(post.postId, "submit");
            else if (post.status === "IN_REVIEW") void action(post.postId, "approve");
            else if (post.status === "APPROVED") openSchedule(post.postId);
            else if (post.status === "SCHEDULED") void action(post.postId, "cancel");
          }}
          />
        );
      })()}
    </div>
  );
}


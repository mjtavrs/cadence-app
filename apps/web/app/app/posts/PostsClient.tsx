"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { SchedulePostDialog } from "@/components/posts/schedule-post-dialog";
import { getNextQuarterSlotInTimeZone } from "@/lib/datetime";
import { PostCard, type PostListItem, type PostStatus } from "@/components/posts/post-card";
import { PostsFiltersBar } from "@/components/posts/posts-filters-bar";

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

  const items = useMemo(() => {
    const fetchedItems = postsQuery.data ?? [];
    if (!tagFilters.length) return fetchedItems;
    return fetchedItems.filter((p) => {
      const tags = (p.tags ?? []).map((t) => t.toLowerCase());
      return tagFilters.some((t) => tags.includes(t.toLowerCase()));
    });
  }, [postsQuery.data, tagFilters]);

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
            <PostCard
              key={p.postId}
              item={p as unknown as PostListItem}
              isBusy={isBusy}
              onSubmit={() => void action(p.postId, "submit")}
              onApprove={() => void action(p.postId, "approve")}
              onSchedule={() => openSchedule(p.postId)}
              onCancel={() => void action(p.postId, "cancel")}
            />
          ))}
        </div>
      )}
    </div>
  );
}


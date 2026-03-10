"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SchedulePostDialog } from "@/components/posts/schedule-post-dialog";
import { getNextQuarterSlotInTimeZone, formatDateAndTime, formatDateForSection } from "@/lib/datetime";
import { PostCard, type PostListItem, type PostStatus } from "@/components/posts/post-card";
import { PostsFiltersBar } from "@/components/posts/posts-filters-bar";
import { PostPreviewSheet } from "@/components/posts/post-preview-sheet";
import { MdOutlineHistoryEdu } from "react-icons/md";
import { useWorkspaceRole } from "@/hooks/use-workspace-role";

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
  flaggedAt?: string;
  flaggedByLabel?: string;
  flagReason?: string;
};

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

export function PostsClient(props: { initialItems: Post[] }) {
  const router = useRouter();
  const { role } = useWorkspaceRole();
  const canManageApproval = role === "OWNER" || role === "ADMIN";
  const queryClient = useQueryClient();
  const [schedulePostId, setSchedulePostId] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleKey, setScheduleKey] = useState(0);
  const [scheduleDefaultDate, setScheduleDefaultDate] = useState<Date>(() => new Date());
  const [scheduleDefaultTime, setScheduleDefaultTime] = useState<string>(() => "00:00");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<PostStatus[]>([]);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [previewPostId, setPreviewPostId] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  type ListResponse = { items: Post[] };

  async function loadPosts() {
    const url = new URL("/api/posts", window.location.origin);
    const res = await fetch(url, { cache: "no-store" });
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

  const availableTags = useMemo(() => {
    const items = postsQuery.data ?? [];
    const set = new Set<string>();
    for (const p of items) {
      for (const t of p.tags ?? []) {
        const n = t.trim().toLowerCase();
        if (n) set.add(n);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [postsQuery.data]);

  const availableStatuses = useMemo(() => {
    const order: PostStatus[] = ["DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "FAILED"];
    const present = new Set<PostStatus>((postsQuery.data ?? []).map((post) => post.status));
    return order.filter((status) => present.has(status));
  }, [postsQuery.data]);

  const filteredItems = useMemo(() => {
    const items = postsQuery.data ?? [];
    const q = searchQuery.trim().toLowerCase();
    const bySearch = q
      ? items.filter((p) => {
          const title = (p.title ?? "").toLowerCase();
          const code = (p.shortCode ?? "").toLowerCase();
          return title.includes(q) || code.includes(q);
        })
      : items;
    const byStatus =
      statusFilters.length > 0
        ? bySearch.filter((p) => statusFilters.includes(p.status))
        : bySearch;
    const byTags =
      tagFilters.length > 0
        ? byStatus.filter((p) => {
            const postTags = (p.tags ?? []).map((t) => t.toLowerCase());
            return tagFilters.some((t) => postTags.includes(t.toLowerCase()));
          })
        : byStatus;
    const byDate =
      dateRange.from != null || dateRange.to != null
        ? byTags.filter((p) => {
            const scheduled = p.scheduledAtUtc ? new Date(p.scheduledAtUtc).getTime() : null;
            if (scheduled == null) return !dateRange.from && !dateRange.to;
            if (dateRange.from != null && scheduled < dateRange.from.getTime()) return false;
            if (dateRange.to != null) {
              const toEnd = new Date(dateRange.to);
              toEnd.setHours(23, 59, 59, 999);
              if (scheduled > toEnd.getTime()) return false;
            }
            return true;
          })
        : byTags;
    return byDate;
  }, [postsQuery.data, searchQuery, statusFilters, tagFilters, dateRange.from, dateRange.to]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, Post[]>();
    for (const post of filteredItems) {
      const isDraft = post.status === "DRAFT";
      const dateKey = isDraft
        ? "Rascunhos"
        : post.scheduledAtUtc
          ? formatDateForSection(post.scheduledAtUtc)
          : "Sem agendamento";
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(post);
    }
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "Hoje") return -1;
      if (b[0] === "Hoje") return 1;
      if (a[0] === "Amanhã") return -1;
      if (b[0] === "Amanhã") return 1;
      if (a[0] === "Rascunhos") return 1;
      if (b[0] === "Rascunhos") return -1;
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

  const flaggedPosts = useMemo(() => {
    return filteredItems
      .filter((post) => !!post.flaggedAt)
      .sort((a, b) => {
        const aTime = a.flaggedAt ? new Date(a.flaggedAt).getTime() : 0;
        const bTime = b.flaggedAt ? new Date(b.flaggedAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [filteredItems]);

  const isBusy = useMemo(() => postsQuery.isFetching, [postsQuery.isFetching]);

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: ["posts"] });

  const actionMutation = useMutation({
    mutationFn: async (params: { postId: string; action: "submit" | "approve" | "cancel" | "retry" }) => {
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

  const flagMutation = useMutation({
    mutationFn: async (params: { postId: string; reason: string }) => {
      const res = await fetch(`/api/posts/${encodeURIComponent(params.postId)}/flag`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: params.reason }),
      });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao sinalizar post.");
    },
    onSuccess: invalidate,
  });

  const unflagMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/unflag`, {
        method: "POST",
      });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao dessinalizar post.");
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

  async function action(postId: string, actionName: "submit" | "approve" | "cancel" | "retry") {
    try {
      await actionMutation.mutateAsync({ postId, action: actionName });
      const msg =
        actionName === "submit"
          ? "Post enviado para aprovação."
          : actionName === "approve"
            ? "Post aprovado."
            : actionName === "cancel"
              ? "Agendamento cancelado."
              : "Post reagendado para +2 minutos.";
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
    if (deletingPostId === postId) return;
    setDeletingPostId(postId);
    try {
      await deleteMutation.mutateAsync(postId);
      toast.success("Post deletado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao deletar post.");
    } finally {
      setDeletingPostId((current) => (current === postId ? null : current));
    }
  }

  function scrollToPost(postId: string) {
    const target = document.getElementById(`post-${postId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedPostId(postId);
    window.setTimeout(() => {
      setHighlightedPostId((current) => (current === postId ? null : current));
    }, 1800);
  }

  async function flagPost(postId: string, reason: string) {
    try {
      await flagMutation.mutateAsync({ postId, reason });
      toast.success("Post sinalizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao sinalizar post.");
    }
  }

  async function unflagPost(postId: string) {
    try {
      await unflagMutation.mutateAsync(postId);
      toast.success("Sinalização removida.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao dessinalizar post.");
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
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        statusFilters={statusFilters}
        onStatusFiltersChange={setStatusFilters}
        tagFilters={tagFilters}
        onTagFiltersChange={setTagFilters}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        availableTags={availableTags}
        availableStatuses={availableStatuses}
      />

      {flaggedPosts.length > 0 ? (
        <section className="rounded-xl border border-amber-500/35 bg-amber-50/70 p-4 dark:bg-amber-500/10">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200">
              Você possui posts sinalizados.
            </h2>
            <p className="text-sm text-amber-800/90 dark:text-amber-200/80">
              Os seguintes posts foram sinalizados por membros da sua equipe para revisão:
            </p>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {flaggedPosts.slice(0, 5).map((post) => (
              <button
                key={post.postId}
                type="button"
                onClick={() => scrollToPost(post.postId)}
                className="w-full cursor-pointer rounded-lg border border-amber-500/20 bg-background/80 px-3 py-2 text-left text-sm transition-colors hover:bg-background"
              >
                <span className="font-medium">{post.title?.trim() || "Sem título"}</span>
                <span className="text-muted-foreground">
                  {" "}
                  • sinalizado em {post.flaggedAt ? formatDateAndTime(post.flaggedAt).replace(" • ", " às ") : "--"}
                </span>
              </button>
            ))}
            {flaggedPosts.length > 5 ? (
              <p className="text-xs text-amber-900/75 dark:text-amber-200/75">
                +{flaggedPosts.length - 5} posts sinalizados
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {postsQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : filteredItems.length === 0 ? (
        <Empty className="min-h-full border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MdOutlineHistoryEdu className="size-6" />
            </EmptyMedia>
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
                  return (
                    <div key={p.postId} id={`post-${p.postId}`}>
                      <PostCard
                        item={p as unknown as PostListItem}
                        isDeleting={deletingPostId === p.postId}
                        isBusy={
                          isBusy ||
                          duplicateMutation.isPending ||
                          flagMutation.isPending ||
                          unflagMutation.isPending
                        }
                        isHighlighted={highlightedPostId === p.postId}
                        onSubmit={() => void action(p.postId, "submit")}
                        onApprove={canManageApproval ? () => void action(p.postId, "approve") : undefined}
                        onSchedule={canManageApproval ? () => openSchedule(p.postId) : undefined}
                        onCancel={canManageApproval ? () => void action(p.postId, "cancel") : undefined}
                        onRetry={canManageApproval ? () => void action(p.postId, "retry") : undefined}
                        submitLabel="Enviar para aprovação"
                        onDelete={() => void deletePost(p.postId)}
                        onPreview={() => setPreviewPostId(p.postId)}
                        onDuplicate={() => {
                          duplicateMutation.mutate(p);
                        }}
                        onCaptionMore={() => setPreviewPostId(p.postId)}
                        onFlag={(reason) => flagPost(p.postId, reason)}
                        onUnflag={() => unflagPost(p.postId)}
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
        const canRunNextStatus =
          foundPost == null
            ? true
            : foundPost.status === "DRAFT" ||
              (canManageApproval &&
                (foundPost.status === "IN_REVIEW" ||
                  foundPost.status === "APPROVED" ||
                  foundPost.status === "SCHEDULED" ||
                  foundPost.status === "FAILED"));
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
          onNextStatus={
            canRunNextStatus
              ? () => {
                  const post = filteredItems.find((p) => p.postId === previewPostId);
                  if (!post) return;
                  if (post.status === "DRAFT") void action(post.postId, "submit");
                  else if (post.status === "IN_REVIEW" && canManageApproval) void action(post.postId, "approve");
                  else if (post.status === "APPROVED" && canManageApproval) openSchedule(post.postId);
                  else if (post.status === "SCHEDULED" && canManageApproval) void action(post.postId, "cancel");
                  else if (post.status === "FAILED" && canManageApproval) void action(post.postId, "retry");
                }
              : undefined
          }
          nextStatusLabel={
            foundPost?.status === "DRAFT"
              ? "Enviar para aprovação"
              : foundPost?.status === "FAILED" && canManageApproval
                ? "Reagendar (+2 min)"
                : undefined
          }
          />
        );
      })()}
    </div>
  );
}

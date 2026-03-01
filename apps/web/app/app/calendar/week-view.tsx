"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarCellContextMenu } from "@/components/calendar/calendar-cell-context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarPostContextMenu } from "@/components/calendar/calendar-post-context-menu";
import { buildUtcIsoFromRecifeSelection, getNextQuarterSlotInTimeZone } from "@/lib/datetime";

import type { WeekBucket } from "./recife-time";
import { getIsoWeekStartRecife } from "./recife-time";
import { PostPreviewDialog, type CalendarPreviewPost } from "./post-preview-dialog";
import { getRecifePartsFromIsoUtc, getRecifePartsFromUtcDate, recifeDayKey, recifeDayKeyFromUtcDate } from "./recife-time";

type PostStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED";

type Post = {
  postId: string;
  status: PostStatus;
  title?: string;
  shortCode?: string;
  tags?: string[];
  caption: string;
  scheduledAtUtc?: string;
  mediaIds?: string[];
};

type ListResponse = { items: Post[] };

const START_HOUR = 6;
const END_HOUR = 22;

const LEFT_COL_WIDTH = 72;
const TOP_PADDING = 10;
const HOUR_HEIGHT = 80;
const PX_PER_MIN = HOUR_HEIGHT / 60;
const SLOT_MINUTES = 15;
const SLOT_HEIGHT = SLOT_MINUTES * PX_PER_MIN;
const EVENT_HEIGHT = 18;
const EVENT_STACK_GAP = 2;

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

function formatDayHeader(dateUtc: Date) {
  const parts = getRecifePartsFromUtcDate(dateUtc);
  if (!parts) return { weekday: "", day: "" };
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "America/Recife",
  }).format(dateUtc).replace(".", "");
  return { weekday, day: parts.day };
}

function statusBarClass(status: PostStatus) {
  if (status === "PUBLISHED") return "bg-emerald-500";
  if (status === "APPROVED" || status === "SCHEDULED") return "bg-primary";
  if (status === "DRAFT" || status === "IN_REVIEW") return "bg-amber-500";
  if (status === "FAILED") return "bg-destructive";
  return "bg-muted-foreground/50";
}

async function loadWeek(week: WeekBucket) {
  const res = await fetch(`/api/posts?week=${encodeURIComponent(week)}`, { cache: "no-store" });
  const payload = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao carregar semana.");
  return ((payload as ListResponse | null)?.items ?? []) as Post[];
}

export function WeekCalendarView(props: {
  week: WeekBucket;
  copiedPost: { postId: string; title?: string; scheduledAtUtc?: string } | null;
  onCopyPost: (post: { postId: string; title?: string; scheduledAtUtc?: string } | null) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<CalendarPreviewPost | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [optimisticPosts, setOptimisticPosts] = useState<Post[]>([]);
  const pendingSlotRef = useRef<{ dayKey: string; timeHHmm: string; scheduledAtUtc: string } | null>(null);

  const query = useQuery({
    queryKey: ["calendar-week", props.week],
    queryFn: () => loadWeek(props.week),
    staleTime: 15_000,
  });

  const invalidateCalendar = () =>
    queryClient.invalidateQueries({ queryKey: ["calendar-week"] });

  const revertMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/revert-to-draft`, { method: "POST" });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao mover para rascunho.");
    },
    onSuccess: () => invalidateCalendar(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao excluir post.");
    },
    onSuccess: () => {
      setPostToDelete(null);
      invalidateCalendar();
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (params: { sourcePostId: string; scheduledAtUtc: string }) => {
      const res = await fetch(`/api/posts/${encodeURIComponent(params.sourcePostId)}/duplicate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheduledAtUtc: params.scheduledAtUtc }),
      });
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao colar postagem.");
      return payload as { postId?: string; scheduledAtUtc?: string };
    },
    onSuccess: () => invalidateCalendar(),
  });

  const days = useMemo(() => {
    const startRecife = getIsoWeekStartRecife(props.week);
    if (!startRecife) return [];
    const start = new Date(startRecife);
    start.setUTCDate(start.getUTCDate() - 1);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      return d;
    });
  }, [props.week]);

  const weekRangeUtc = useMemo(() => {
    const startRecife = getIsoWeekStartRecife(props.week);
    if (!startRecife) return null;
    const startUtcForRecife = new Date(startRecife);
    startUtcForRecife.setUTCDate(startUtcForRecife.getUTCDate() - 1);
    const endUtcForRecife = new Date(startUtcForRecife.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start: startUtcForRecife, end: endUtcForRecife } as const;
  }, [props.week]);

  const grouped = useMemo(() => {
    const map = new Map<string, Post[]>();
    const items = [...(query.data ?? []), ...optimisticPosts];
    const startMs = weekRangeUtc?.start.getTime() ?? -Infinity;
    const endMs = weekRangeUtc?.end.getTime() ?? Infinity;

    for (const p of items) {
      if (!p.scheduledAtUtc) continue;
      const utc = new Date(p.scheduledAtUtc);
      const utcMs = utc.getTime();
      if (Number.isNaN(utcMs)) continue;
      if (utcMs < startMs || utcMs >= endMs) continue;

      const parts = getRecifePartsFromIsoUtc(p.scheduledAtUtc);
      if (!parts) continue;
      const k = recifeDayKey(parts);
      const list = map.get(k) ?? [];
      list.push(p);
      map.set(k, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.scheduledAtUtc ?? "").localeCompare(b.scheduledAtUtc ?? ""));
    }
    return map;
  }, [optimisticPosts, query.data, weekRangeUtc]);

  const hourLines = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => START_HOUR + i),
    []
  );
  const hourLabels = useMemo(
    () => Array.from({ length: (END_HOUR - 1) - (START_HOUR + 1) + 1 }).map((_, i) => START_HOUR + 1 + i),
    []
  );

  const totalMinutes = (END_HOUR - START_HOUR) * 60;
  const contentHeight = TOP_PADDING + Math.round(totalMinutes * PX_PER_MIN) + EVENT_HEIGHT + 2;
  const todayKey = useMemo(() => recifeDayKeyFromUtcDate(new Date()) ?? "", []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedEventId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function openPreview(p: Post) {
    setSelected(p);
    setPreviewOpen(true);
  }

  function dayKeyToCalendarDate(dayKey: string) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  function getSnappedTimeFromContextMenu(event: React.MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top - TOP_PADDING;
    const rawMinutes = y / PX_PER_MIN;
    const snappedMinutes = Math.max(0, Math.min(totalMinutes, Math.round(rawMinutes / SLOT_MINUTES) * SLOT_MINUTES));
    const hour = START_HOUR + Math.floor(snappedMinutes / 60);
    const minute = snappedMinutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function parseTimeHHmm(value: string) {
    const m = /^(\d{2}):(\d{2})$/.exec(value);
    if (!m) return null;
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return { hour, minute };
  }

  function resolveQuarterWithinHour(dayKey: string, hour: number, preferredMinute: number) {
    const allowedQuarters = hour === END_HOUR ? [0] : [0, 15, 30, 45];
    const occupied = new Set<number>();
    const items = grouped.get(dayKey) ?? [];
    for (const p of items) {
      if (!p.scheduledAtUtc) continue;
      const parts = getRecifePartsFromIsoUtc(p.scheduledAtUtc);
      if (!parts) continue;
      if (parts.hour === hour && allowedQuarters.includes(parts.minute)) {
        occupied.add(parts.minute);
      }
    }

    const startIdx = Math.max(0, allowedQuarters.indexOf(preferredMinute));
    for (let i = 0; i < allowedQuarters.length; i++) {
      const q = allowedQuarters[(startIdx + i) % allowedQuarters.length];
      if (!occupied.has(q)) return q;
    }
    return null;
  }

  function goCreateWithSlot(dayKey: string, timeHHmm: string) {
    const url = new URL("/app/posts/new", window.location.origin);
    url.searchParams.set("prefillDate", dayKey);
    url.searchParams.set("prefillTime", timeHHmm);
    router.push(`${url.pathname}?${url.searchParams.toString()}`);
  }

  function formatSuccessForUtc(isoUtc: string) {
    const parts = getRecifePartsFromIsoUtc(isoUtc);
    if (!parts) return "Postagem criada.";
    return `Postagem criada para ${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")} às ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  }

  function moveToDraft(postId: string) {
    void toast.promise(revertMutation.mutateAsync(postId), {
      loading: "Movendo para rascunho...",
      success: "Postagem movida para rascunho.",
      error: (e) => (e instanceof Error ? e.message : "Falha ao mover para rascunho."),
    });
  }

  async function pasteIntoIso(scheduledAtUtc: string) {
    if (!props.copiedPost?.postId) {
      toast.error("Nenhuma postagem copiada.");
      return;
    }

    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setOptimisticPosts((prev) => [
      ...prev,
      {
        postId: optimisticId,
        status: "SCHEDULED",
        title: props.copiedPost?.title ?? "Copiando...",
        caption: "",
        scheduledAtUtc,
        tags: [],
        mediaIds: [],
      },
    ]);

    const request = duplicateMutation.mutateAsync({
      sourcePostId: props.copiedPost.postId,
      scheduledAtUtc,
    });

    try {
      await toast.promise(request, {
        loading: "Criando postagem...",
        success: () => formatSuccessForUtc(scheduledAtUtc),
        error: (e) => (e instanceof Error ? e.message : "Falha ao colar postagem."),
      });
    } finally {
      setOptimisticPosts((prev) => prev.filter((p) => p.postId !== optimisticId));
    }
  }

  return (
    <>
      {query.isError && (
        <p className="text-destructive text-sm">
          {(query.error as Error)?.message ?? "Falha ao carregar semana."}
        </p>
      )}

      <div className="bg-card">
        <div className={cn("grid border-b bg-background/80 px-0 py-0 backdrop-blur")} style={{ gridTemplateColumns: `${LEFT_COL_WIDTH}px 1fr` }}>
          <div className="text-muted-foreground px-2 py-2 text-[11px] font-medium">Hora</div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const parts = getRecifePartsFromIsoUtc(d.toISOString());
              const dayKey = parts ? recifeDayKey(parts) : "";
              const isToday = dayKey && dayKey === todayKey;
              const header = formatDayHeader(d);
              return (
                <div key={d.toISOString()} className="px-2 py-2 text-[11px] font-medium text-muted-foreground">
                  <span>{header.weekday} </span>
                  <span className={cn(isToday && "bg-destructive !text-white rounded px-1.5 py-0.5")}>{header.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-300px)] min-h-[520px]">
          <div
            className={cn("grid")}
            style={{ gridTemplateColumns: `${LEFT_COL_WIDTH}px 1fr` }}
            onMouseDownCapture={(event) => {
              if (event.button !== 0) return;
              const target = event.target as HTMLElement | null;
              if (target?.closest('[data-event-chip="true"]')) return;
              setSelectedEventId(null);
            }}
          >
            <div className="sticky left-0 z-10 border-r border-border/60 bg-background/80 backdrop-blur">
              <div className="relative" style={{ height: contentHeight }}>
                {hourLabels.map((h) => {
                  const top = TOP_PADDING + Math.round(((h - START_HOUR) * 60) * PX_PER_MIN);
                  return (
                    <div key={h} className="absolute left-0 right-0 -translate-y-1/2" style={{ top }}>
                      <div className="text-muted-foreground px-2 text-[11px]">{String(h).padStart(2, "0")}:00</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-7">
              {days.map((d, idx) => {
                const dayParts = getRecifePartsFromIsoUtc(d.toISOString());
                const key = dayParts
                  ? recifeDayKey(dayParts)
                  : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
                const items = grouped.get(key) ?? [];

                const byMinute = new Map<number, Post[]>();
                for (const p of items) {
                  if (!p.scheduledAtUtc) continue;
                  const parts = getRecifePartsFromIsoUtc(p.scheduledAtUtc);
                  if (!parts) continue;
                  const minutesFromStart = (parts.hour - START_HOUR) * 60 + parts.minute;
                  if (minutesFromStart < 0 || minutesFromStart > totalMinutes) continue;
                  const list = byMinute.get(minutesFromStart) ?? [];
                  list.push(p);
                  byMinute.set(minutesFromStart, list);
                }

                const isLastCol = idx === 6;

                return (
                  <CalendarCellContextMenu
                    key={d.toISOString()}
                    canPaste={!!props.copiedPost}
                    onOpenContextMenu={(event) => {
                      const timeHHmm = getSnappedTimeFromContextMenu(event);
                      const parsed = parseTimeHHmm(timeHHmm);
                      const selectedDate = dayKeyToCalendarDate(key);
                      if (!selectedDate || !parsed) {
                        pendingSlotRef.current = null;
                        return;
                      }
                      const quarter = resolveQuarterWithinHour(key, parsed.hour, parsed.minute);
                      if (quarter == null) {
                        pendingSlotRef.current = null;
                        return;
                      }
                      const safeTime = `${String(parsed.hour).padStart(2, "0")}:${String(quarter).padStart(2, "0")}`;
                      try {
                        const targetIso = buildUtcIsoFromRecifeSelection({
                          selectedDate,
                          timeHHmm: safeTime,
                          timeZone: "America/Recife",
                        });
                        pendingSlotRef.current = { dayKey: key, timeHHmm: safeTime, scheduledAtUtc: targetIso };
                      } catch {
                        pendingSlotRef.current = null;
                      }
                    }}
                    onCreatePost={() => {
                      const time = pendingSlotRef.current && pendingSlotRef.current.dayKey === key
                        ? pendingSlotRef.current.timeHHmm
                        : getNextQuarterSlotInTimeZone(new Date(), "America/Recife").time;
                      goCreateWithSlot(key, time);
                    }}
                    onPastePost={() => {
                      const target =
                        pendingSlotRef.current && pendingSlotRef.current.dayKey === key
                          ? pendingSlotRef.current.scheduledAtUtc
                          : null;
                      if (!target) {
                        toast.error("Essa hora já está cheia. Escolha outra célula.");
                        return;
                      }
                      void pasteIntoIso(target);
                    }}
                  >
                    <div className={cn("border-r", "border-border/60", isLastCol && "border-r-0")}>
                      <div className="relative" style={{ height: contentHeight }}>
                        {hourLines.map((h) => {
                          const top = TOP_PADDING + Math.round(((h - START_HOUR) * 60) * PX_PER_MIN);
                          return (
                            <div key={h} className="absolute left-0 right-0 z-0 border-t border-border/50" style={{ top }} />
                          );
                        })}

                        {Array.from(byMinute.entries()).map(([minute, list]) => {
                          const slotOffset = Math.max(0, (SLOT_HEIGHT - EVENT_HEIGHT) / 2);
                          const topBase =
                            minute === totalMinutes
                              ? TOP_PADDING + minute * PX_PER_MIN - EVENT_HEIGHT - 1
                              : TOP_PADDING + minute * PX_PER_MIN + slotOffset;
                          return list.map((p, stackIndex) => {
                            const top = Math.round(topBase + stackIndex * (EVENT_HEIGHT + EVENT_STACK_GAP));
                            return (
                              <CalendarPostContextMenu
                                key={`${p.postId}-${minute}-${stackIndex}`}
                                post={{ postId: p.postId, status: p.status }}
                                onMoveToDraft={() => moveToDraft(p.postId)}
                                onCopyPost={() => {
                                  props.onCopyPost({ postId: p.postId, title: p.title, scheduledAtUtc: p.scheduledAtUtc });
                                  toast.success("Postagem copiada.");
                                }}
                                onEdit={() => router.push(`/app/posts/${p.postId}`)}
                                onDelete={() => setPostToDelete(p)}
                                isBusy={revertMutation.isPending || deleteMutation.isPending || duplicateMutation.isPending}
                              >
                                <button
                                  type="button"
                                  data-event-chip="true"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedEventId(p.postId);
                                  }}
                                  onDoubleClick={() => openPreview(p)}
                                  className={cn(
                                    "group absolute left-1 right-1 z-10 flex min-w-0 items-center gap-1 rounded-md px-2 py-0 text-left",
                                    "bg-background/90",
                                    "transition-colors hover:bg-muted",
                                    selectedEventId === p.postId && "ring-2 ring-primary/60"
                                  )}
                                  style={{ top, height: EVENT_HEIGHT }}
                                  title={p.title ?? p.postId}
                                >
                                  <span className={cn("h-4 w-1.5 shrink-0 rounded-full", statusBarClass(p.status))} />
                                  <span className="min-w-0 truncate text-[11px] font-medium leading-none">
                                    {p.title?.trim() ? p.title : "Sem título"}
                                  </span>
                                </button>
                              </CalendarPostContextMenu>
                            );
                          });
                        })}
                      </div>
                    </div>
                  </CalendarCellContextMenu>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </div>

      <PostPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} post={selected} />

      <AlertDialog open={!!postToDelete} onOpenChange={(open) => !open && setPostToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir post?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O post será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!postToDelete) return;
                void toast.promise(deleteMutation.mutateAsync(postToDelete.postId), {
                  loading: "Excluindo postagem...",
                  success: "Postagem excluída.",
                  error: (e) => (e instanceof Error ? e.message : "Falha ao excluir post."),
                });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

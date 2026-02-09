"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { WeekBucket } from "./recife-time";
import { getIsoWeekStartRecife } from "./recife-time";
import { addWeeksUtc } from "./calendar-utils";
import { PostPreviewDialog, type CalendarPreviewPost } from "./post-preview-dialog";
import { getRecifePartsFromIsoUtc, recifeDayKey, recifeDayKeyFromUtcDate } from "./recife-time";

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
};

type ListResponse = { items: Post[] };

const START_HOUR = 6;
const END_HOUR = 22;

const LEFT_COL_WIDTH = 72;
const TOP_PADDING = 10;
const HOUR_HEIGHT = 64;
const PX_PER_MIN = HOUR_HEIGHT / 60;
const EVENT_HEIGHT = 22;
const EVENT_STACK_GAP = 4;
const EVENT_TOP_OFFSET = 6; // respiro para não encostar na linha da hora

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

function formatDayHeader(dateUtc: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Recife",
  }).format(dateUtc);
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

async function loadWeekRange(week: WeekBucket) {
  return loadWeek(week);
}

export function WeekCalendarView(props: { week: WeekBucket }) {
  const [selected, setSelected] = useState<CalendarPreviewPost | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const query = useQuery({
    queryKey: ["calendar-week", props.week],
    queryFn: () => loadWeekRange(props.week),
    staleTime: 15_000,
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
    const endUtcForRecife = new Date(
      startUtcForRecife.getTime() + 7 * 24 * 60 * 60 * 1000
    );
    return { start: startUtcForRecife, end: endUtcForRecife } as const;
  }, [props.week]);

  const grouped = useMemo(() => {
    const map = new Map<string, Post[]>();
    const items = query.data ?? [];

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
  }, [query.data, weekRangeUtc]);

  const hourLines = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => START_HOUR + i),
    [],
  );
  // Não exibimos o label 06:00 e 22:00 (mas mantemos as linhas).
  const hourLabels = useMemo(
    () => Array.from({ length: (END_HOUR - 1) - (START_HOUR + 1) + 1 }).map((_, i) => START_HOUR + 1 + i),
    [],
  );

  const totalMinutes = (END_HOUR - START_HOUR) * 60;
  const contentHeight = TOP_PADDING + Math.round(totalMinutes * PX_PER_MIN);
  const todayKey = useMemo(() => recifeDayKeyFromUtcDate(new Date()) ?? "", []);

  function openPreview(p: Post) {
    setSelected(p);
    setPreviewOpen(true);
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
              return (
                <div
                  key={d.toISOString()}
                  className={cn(
                    "px-2 py-2 text-[11px] font-medium",
                    isToday ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {formatDayHeader(d)}
                </div>
              );
            })}
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-300px)] min-h-[520px]">
          <div className={cn("grid")} style={{ gridTemplateColumns: `${LEFT_COL_WIDTH}px 1fr` }}>
            {/* Time labels */}
            <div className="sticky left-0 z-10 border-r border-border/40 bg-background/80 backdrop-blur">
              <div className="relative" style={{ height: contentHeight }}>
                {hourLabels.map((h) => {
                  const top = TOP_PADDING + Math.round(((h - START_HOUR) * 60) * PX_PER_MIN);
                  return (
                    <div
                      key={h}
                      className="absolute left-0 right-0 -translate-y-1/2"
                      style={{ top }}
                    >
                      <div className="text-muted-foreground px-2 text-[11px]">
                        {String(h).padStart(2, "0")}:00
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Days columns */}
            <div className="grid grid-cols-7">
              {days.map((d, idx) => {
                const dayParts = getRecifePartsFromIsoUtc(d.toISOString());
                const key = dayParts ? recifeDayKey(dayParts) : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
                const items = grouped.get(key) ?? [];
                const isToday = key === todayKey;

                // Map minute -> posts (pra empilhar colisões)
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
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "border-r",
                      "border-border/40",
                      isLastCol && "border-r-0",
                      isToday && "bg-destructive/5",
                    )}
                  >
                    <div className="relative" style={{ height: contentHeight }}>
                      {/* Hour lines */}
                      {hourLines.map((h) => {
                        const top = TOP_PADDING + Math.round(((h - START_HOUR) * 60) * PX_PER_MIN);
                        return (
                          <div
                            key={h}
                            className="absolute left-0 right-0 z-0 border-t border-border/30"
                            style={{ top }}
                          />
                        );
                      })}

                      {/* Events */}
                      {Array.from(byMinute.entries()).map(([minute, list]) => {
                        const topBase = TOP_PADDING + minute * PX_PER_MIN + EVENT_TOP_OFFSET;
                        return list.map((p, stackIndex) => {
                          const top = Math.round(topBase + stackIndex * (EVENT_HEIGHT + EVENT_STACK_GAP));
                          return (
                            <button
                              key={`${p.postId}-${minute}-${stackIndex}`}
                              type="button"
                              onClick={() => openPreview(p)}
                              className={cn(
                                "group absolute left-1 right-1 z-10 flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left",
                                "bg-background/90",
                                "hover:bg-muted/60",
                              )}
                              style={{ top, height: EVENT_HEIGHT }}
                              title={p.title ?? p.postId}
                            >
                              <span className={cn("h-4 w-1 shrink-0 rounded-full", statusBarClass(p.status))} />
                              <span className="min-w-0 truncate text-[11px] font-medium">
                                {p.title?.trim() ? p.title : "Sem título"}
                              </span>
                            </button>
                          );
                        });
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </div>

      <PostPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} post={selected} />
    </>
  );
}


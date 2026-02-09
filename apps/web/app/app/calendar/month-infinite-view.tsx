"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { MonthBucket } from "./month-utils";
import { getMonthGridStartUtc } from "./month-utils";
import { PostPreviewDialog, type CalendarPreviewPost } from "./post-preview-dialog";
import {
  formatRecifeTimeFromIsoUtc,
  getRecifePartsFromIsoUtc,
  recifeDayKeyFromUtcDate,
  recifeMonthBucketFromIsoUtc,
} from "./recife-time";

type PostStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED";

type CalendarMonthPost = {
  postId: string;
  status: PostStatus;
  title?: string;
  shortCode?: string;
  tags?: string[];
  caption: string;
  scheduledAtUtc?: string;
};

type ListResponse = { items: CalendarMonthPost[] };

const MAX_VISIBLE_PER_DAY = 3;
const RANGE_PAST_MONTHS = 12;
const RANGE_FUTURE_MONTHS = 12;

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

function parseMonthBucket(bucket: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(bucket);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month } as const;
}

function addMonths(bucket: MonthBucket, delta: number): MonthBucket {
  const p = parseMonthBucket(bucket);
  if (!p) return bucket;
  let year = p.year;
  let month = p.month + delta;
  while (month <= 0) {
    month += 12;
    year -= 1;
  }
  while (month >= 13) {
    month -= 12;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}` as MonthBucket;
}

function monthLabelShortPtBr(bucket: MonthBucket) {
  const p = parseMonthBucket(bucket);
  if (!p) return bucket;
  const d = new Date(Date.UTC(p.year, p.month - 1, 1, 12, 0, 0));
  return new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
    .format(d)
    .replace(".", "");
}

function dayKeyFromUtcDate(date: Date) {
  return recifeDayKeyFromUtcDate(date) ?? date.toISOString().slice(0, 10);
}

function formatDayNumber(dateUtc: Date) {
  const p = getRecifePartsFromIsoUtc(dateUtc.toISOString());
  return p ? String(p.day) : String(dateUtc.getUTCDate());
}

function statusBarClass(status: PostStatus) {
  if (status === "PUBLISHED") return "bg-emerald-500";
  if (status === "APPROVED" || status === "SCHEDULED") return "bg-primary";
  if (status === "DRAFT" || status === "IN_REVIEW") return "bg-amber-500";
  if (status === "FAILED") return "bg-destructive";
  return "bg-muted-foreground/50";
}

async function loadMonth(month: MonthBucket) {
  const res = await fetch(`/api/posts?month=${encodeURIComponent(month)}`, { cache: "no-store" });
  const payload = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao carregar mês.");
  return ((payload as ListResponse | null)?.items ?? []) as CalendarMonthPost[];
}

export function MonthInfiniteCalendarView(props: {
  initialMonth: MonthBucket;
  heightClassName?: string;
  onActiveMonthChange?(month: MonthBucket): void;
}) {
  const { initialMonth, heightClassName, onActiveMonthChange } = props;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null);

  const [loadedMonths, setLoadedMonths] = useState<MonthBucket[]>(() => [
    addMonths(initialMonth, -1),
    initialMonth,
    addMonths(initialMonth, 1),
  ]);
  const [activeMonth, setActiveMonth] = useState<MonthBucket>(initialMonth);

  const [selected, setSelected] = useState<CalendarPreviewPost | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [dayOpen, setDayOpen] = useState(false);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [dayItems, setDayItems] = useState<CalendarMonthPost[]>([]);

  const monthMin = useMemo(() => addMonths(initialMonth, -RANGE_PAST_MONTHS), [initialMonth]);
  const monthMax = useMemo(() => addMonths(initialMonth, RANGE_FUTURE_MONTHS), [initialMonth]);

  // Define range contínuo de datas (grid contínuo).
  const dateRange = useMemo(() => {
    const startMonth = monthMin;
    const endMonth = monthMax;
    const sp = parseMonthBucket(startMonth);
    const ep = parseMonthBucket(endMonth);
    if (!sp || !ep) return { start: new Date(), end: new Date(), days: [] as Date[] };

    const startMonthDateUtc = new Date(Date.UTC(sp.year, sp.month - 1, 1, 12, 0, 0));
    const endMonthDateUtc = new Date(Date.UTC(ep.year, ep.month - 1, 1, 12, 0, 0));

    const start = getMonthGridStartUtc(startMonthDateUtc);
    const endStart = getMonthGridStartUtc(endMonthDateUtc);
    const end = new Date(endStart);
    end.setUTCDate(endStart.getUTCDate() + 41);

    const days: Date[] = [];
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      days.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return { start, end, days };
  }, [monthMin, monthMax]);

  const weeks = useMemo(() => {
    const out: Date[][] = [];
    for (let i = 0; i < dateRange.days.length; i += 7) {
      out.push(dateRange.days.slice(i, i + 7));
    }
    return out;
  }, [dateRange.days]);

  const monthQueries = useQueries({
    queries: loadedMonths.map((m) => ({
      queryKey: ["calendar-month", m],
      queryFn: () => loadMonth(m),
      staleTime: 15_000,
    })),
  });

  const allItems = useMemo(() => {
    const out: CalendarMonthPost[] = [];
    for (const q of monthQueries) {
      if (!q.data) continue;
      out.push(...q.data);
    }
    return out;
  }, [monthQueries]);

  const todayKey = useMemo(() => dayKeyFromUtcDate(new Date()), []);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarMonthPost[]>();
    for (const p of allItems) {
      if (!p.scheduledAtUtc) continue;
      const k = dayKeyFromUtcDate(new Date(p.scheduledAtUtc));
      const list = map.get(k) ?? [];
      list.push(p);
      map.set(k, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.scheduledAtUtc ?? "").localeCompare(b.scheduledAtUtc ?? ""));
    }
    return map;
  }, [allItems]);

  useEffect(() => {
    onActiveMonthChange?.(activeMonth);
  }, [activeMonth, onActiveMonthChange]);

  // Resolve o viewport real do ScrollArea (onde o scroll acontece).
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const viewport = wrapper.querySelector<HTMLDivElement>("[data-slot='scroll-area-viewport']");
    if (!viewport) return;
    setViewportEl(viewport);
  }, []);

  // Scroll inicial: centraliza o mês inicial (pelo primeiro dia do mês).
  useEffect(() => {
    const root = viewportEl;
    if (!root) return;
    const marker = root.querySelector<HTMLElement>(`[data-month-start='${initialMonth}']`);
    if (!marker) return;
    marker.scrollIntoView({ block: "start" });
  }, [viewportEl, initialMonth]);

  // Mês ativo: observar o início de cada semana (linha). Atribuímos o mês pela “maioria” da semana
  // usando o dia do meio (quinta) — isso evita trocar para Março só porque "01/03" aparece no final do grid de Fevereiro.
  useEffect(() => {
    const root = viewportEl;
    if (!root) return;
    const markers = Array.from(root.querySelectorAll<HTMLElement>("[data-week-marker]"));
    if (!markers.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => {
            const m = (e.target as HTMLElement).dataset.weekMarker as MonthBucket | undefined;
            return m ? { month: m, top: e.boundingClientRect.top } : null;
          })
          .filter(Boolean) as Array<{ month: MonthBucket; top: number }>;

        if (!visible.length) return;
        visible.sort((a, b) => a.top - b.top);
        setActiveMonth(visible[0].month);
      },
      { root, threshold: 0, rootMargin: "-48px 0px -80% 0px" },
    );

    for (const el of markers) obs.observe(el);
    return () => obs.disconnect();
  }, [viewportEl, weeks.length]);

  useEffect(() => {
    setLoadedMonths((prev) => {
      const desired = [addMonths(activeMonth, -1), activeMonth, addMonths(activeMonth, 1)];
      const within = desired.filter((m) => m >= monthMin && m <= monthMax);
      const next = Array.from(new Set([...prev, ...within])).sort();
      return next;
    });
  }, [activeMonth, monthMin, monthMax]);

  function openPreview(p: CalendarMonthPost) {
    setSelected(p);
    setPreviewOpen(true);
  }

  function openDay(dk: string, items: CalendarMonthPost[]) {
    setDayKey(dk);
    setDayItems(items);
    setDayOpen(true);
  }

  return (
    <>
      <div className="bg-card">
        <div className="grid grid-cols-7 border-b bg-background/80 px-2 py-2 backdrop-blur">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((w) => (
            <div key={w} className="text-muted-foreground px-1 text-[11px] font-medium">
              {w}
            </div>
          ))}
        </div>

        {/* Body scrollável contínuo */}
        <div ref={wrapperRef}>
          <ScrollArea className={cn("h-[calc(100vh-300px)] min-h-[520px]", heightClassName)}>
            <div className="px-2 pb-3">
              {weeks.map((weekDays, rowIdx) => {
                const mid = weekDays[3]; // quinta
                const weekMonth = (recifeMonthBucketFromIsoUtc(mid.toISOString()) ?? initialMonth) as MonthBucket;
                return (
                  <div key={weekDays[0]?.toISOString() ?? rowIdx} className="grid grid-cols-7">
                    {/* marcador por semana para mês ativo */}
                    <div data-week-marker={weekMonth} className="h-px col-span-7" />

                    {weekDays.map((dateUtc, colIdx) => {
                      const dateKey = dayKeyFromUtcDate(dateUtc);
                      const cellMonth = recifeMonthBucketFromIsoUtc(dateUtc.toISOString()) ?? "";

                      const items = grouped.get(dateKey) ?? [];
                      const visible = items.slice(0, MAX_VISIBLE_PER_DAY);
                      const overflow = Math.max(0, items.length - visible.length);

                      const isToday = dateKey === todayKey;
                      const isPast = dateKey < todayKey;

                      const p = getRecifePartsFromIsoUtc(dateUtc.toISOString());
                      const dayNum = p?.day ?? Number(formatDayNumber(dateUtc));
                      const isDayOne = dayNum === 1;

                      const isLastCol = colIdx === 6;

                      const dayTone = isPast ? "text-muted-foreground" : "text-foreground";

                      return (
                        <div
                          key={dateUtc.toISOString()}
                          className={cn(
                            "min-h-[200px] px-1.5 pb-2",
                            "border-border/40 border-r border-b",
                            isLastCol && "border-r-0",
                          )}
                        >
                          {/* ponto de scroll para o mês inicial */}
                          {isDayOne && cellMonth === initialMonth ? (
                            <div data-month-start={initialMonth} className="h-px" />
                          ) : null}

                          <div className="flex items-start justify-between gap-2 pt-2">
                            <div className="flex items-center gap-2">
                              {isDayOne ? (
                                <div className="text-muted-foreground text-[11px] font-medium capitalize">
                                  {monthLabelShortPtBr(cellMonth as MonthBucket)}
                                </div>
                              ) : null}
                            </div>

                            <div
                              className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-md text-xs font-medium",
                                isToday ? "bg-destructive/15 text-destructive" : dayTone,
                              )}
                            >
                              {formatDayNumber(dateUtc)}
                            </div>
                          </div>

                          <div className="mt-2 space-y-1">
                            {visible.map((post) => (
                              <button
                                key={post.postId}
                                type="button"
                                className={cn(
                                  "group flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left",
                                  "hover:bg-muted/60",
                                )}
                                onClick={() => openPreview(post)}
                              >
                                <span className={cn("h-4 w-1 shrink-0 rounded-full", statusBarClass(post.status))} />
                                <span className={cn("min-w-0 truncate text-xs font-medium", isPast && "text-muted-foreground")}>
                                  {post.scheduledAtUtc ? `${formatRecifeTimeFromIsoUtc(post.scheduledAtUtc)} · ` : ""}
                                  {post.title?.trim() ? post.title : "Sem título"}
                                </span>
                              </button>
                            ))}

                            {overflow > 0 ? (
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground mt-1 text-left text-xs font-medium"
                                onClick={() => openDay(dateKey, items)}
                              >
                                +{overflow} mais
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      <PostPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} post={selected} />

      <Dialog
        open={dayOpen}
        onOpenChange={(open) => {
          setDayOpen(open);
          if (!open) {
            setDayKey(null);
            setDayItems([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Posts do dia</DialogTitle>
            <DialogDescription>{dayKey ? `Data: ${dayKey} (America/Recife)` : ""}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[360px] pr-4">
            <div className="space-y-1">
              {dayItems.map((p) => (
                <button
                  key={p.postId}
                  type="button"
                  className={cn(
                    "group flex w-full min-w-0 items-center justify-between gap-3 rounded-md px-2 py-2 text-left",
                    "hover:bg-muted/60",
                  )}
                  onClick={() => {
                    setDayOpen(false);
                    openPreview(p);
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn("h-4 w-1 shrink-0 rounded-full", statusBarClass(p.status))} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {p.scheduledAtUtc ? `${formatRecifeTimeFromIsoUtc(p.scheduledAtUtc)} · ` : ""}
                        {p.title?.trim() ? p.title : "Sem título"}
                      </div>
                      <div className="text-muted-foreground line-clamp-1 text-xs">{p.caption}</div>
                    </div>
                  </div>
                  {p.shortCode ? (
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {p.shortCode}
                    </Badge>
                  ) : null}
                </button>
              ))}

              {!dayItems.length ? <div className="text-muted-foreground text-sm">Sem posts</div> : null}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDayOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


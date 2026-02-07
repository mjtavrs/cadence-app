"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import { buildMonthGridUtc, type MonthBucket } from "./month-utils";
import { PostPreviewDialog, type CalendarPreviewPost } from "./post-preview-dialog";
import { formatRecifeTimeFromIsoUtc, getRecifePartsFromIsoUtc, recifeDayKeyFromUtcDate } from "./recife-time";

type PostStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED";

export type CalendarMonthPost = {
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

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

function dayKeyFromDate(date: Date) {
  return recifeDayKeyFromUtcDate(date) ?? date.toISOString().slice(0, 10);
}

function formatTime(isoUtc: string) {
  return formatRecifeTimeFromIsoUtc(isoUtc);
}

function formatDayNumber(dateUtc: Date) {
  const p = getRecifePartsFromIsoUtc(dateUtc.toISOString());
  return p ? String(p.day) : String(dateUtc.getUTCDate());
}

function statusBarClass(status: PostStatus) {
  if (status === "PUBLISHED") return "bg-emerald-500";
  if (status === "SCHEDULED") return "bg-primary";
  if (status === "FAILED") return "bg-destructive";
  return "bg-muted-foreground/50";
}

async function loadMonth(month: MonthBucket) {
  const res = await fetch(`/api/posts?month=${encodeURIComponent(month)}`, { cache: "no-store" });
  const payload = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao carregar mês.");
  return ((payload as ListResponse | null)?.items ?? []) as CalendarMonthPost[];
}

export function MonthCalendarView(props: { monthBucket: MonthBucket; monthDateUtc: Date }) {
  const [selected, setSelected] = useState<CalendarPreviewPost | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [dayOpen, setDayOpen] = useState(false);
  const [dayKey, setDayKey] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["calendar-month", props.monthBucket],
    queryFn: () => loadMonth(props.monthBucket),
    staleTime: 15_000,
  });

  const grid = useMemo(() => buildMonthGridUtc(props.monthDateUtc), [props.monthDateUtc]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarMonthPost[]>();
    const items = query.data ?? [];
    for (const p of items) {
      if (!p.scheduledAtUtc) continue;
      const k = dayKeyFromDate(new Date(p.scheduledAtUtc));
      const list = map.get(k) ?? [];
      list.push(p);
      map.set(k, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.scheduledAtUtc ?? "").localeCompare(b.scheduledAtUtc ?? ""));
    }
    return map;
  }, [query.data]);

  const weekdayLabels = useMemo(() => ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"], []);

  const dayItems = useMemo(() => {
    if (!dayKey) return [];
    return grouped.get(dayKey) ?? [];
  }, [dayKey, grouped]);

  function openPreview(p: CalendarMonthPost) {
    setSelected(p);
    setPreviewOpen(true);
  }

  return (
    <>
      {query.isError && (
        <p className="text-destructive text-sm">
          {(query.error as Error)?.message ?? "Falha ao carregar mês."}
        </p>
      )}

      <div className="rounded-xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {weekdayLabels.map((w) => (
            <div key={w} className="text-muted-foreground px-2 py-2 text-[11px] font-medium">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {grid.map((dateUtc, idx) => {
            const inMonth = dateUtc.getUTCMonth() === props.monthDateUtc.getUTCMonth();
            const key = dayKeyFromDate(dateUtc);
            const items = grouped.get(key) ?? [];
            const visible = items.slice(0, MAX_VISIBLE_PER_DAY);
            const overflow = Math.max(0, items.length - visible.length);

            const isLastCol = (idx + 1) % 7 === 0;
            const isLastRow = idx >= 35;

            return (
              <div
                key={dateUtc.toISOString()}
                className={cn(
                  "min-h-[120px] p-2",
                  "border-r border-b",
                  isLastCol && "border-r-0",
                  isLastRow && "border-b-0",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={cn("text-xs font-medium", inMonth ? "text-foreground" : "text-muted-foreground")}>
                    {formatDayNumber(dateUtc)}
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  {visible.map((p) => (
                    <button
                      key={p.postId}
                      type="button"
                      className={cn(
                        "group flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left",
                        "hover:bg-muted/60",
                      )}
                      onClick={() => openPreview(p)}
                    >
                      <span className={cn("h-4 w-1 shrink-0 rounded-full", statusBarClass(p.status))} />
                      <span className="min-w-0 truncate text-xs font-medium">
                        {p.scheduledAtUtc ? `${formatTime(p.scheduledAtUtc)} · ` : ""}
                        {p.title?.trim() ? p.title : "Sem título"}
                      </span>
                    </button>
                  ))}

                  {overflow > 0 ? (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground mt-1 text-left text-xs font-medium"
                      onClick={() => {
                        setDayKey(key);
                        setDayOpen(true);
                      }}
                    >
                      +{overflow} mais
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PostPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} post={selected} />

      <Dialog
        open={dayOpen}
        onOpenChange={(open) => {
          setDayOpen(open);
          if (!open) setDayKey(null);
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Posts do dia</DialogTitle>
            <DialogDescription>{dayKey ? `Data: ${dayKey} (${tz})` : ""}</DialogDescription>
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
                        {p.scheduledAtUtc ? `${formatTime(p.scheduledAtUtc)} · ` : ""}
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
              {!query.isLoading && dayItems.length === 0 ? (
                <div className="text-muted-foreground text-sm">Sem posts</div>
              ) : null}
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


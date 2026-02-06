"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

import { addWeeksUtc, getIsoWeekBucketUtc, getIsoWeekStartUtc, type WeekBucket } from "./calendar-utils";

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
  caption: string;
  mediaIds: string[];
  scheduledAtUtc?: string;
  updatedAt: string;
};

type ListResponse = { items: Post[] };

const tz = "America/Recife";

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

function formatDayLabel(dateUtc: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: tz,
  }).format(dateUtc);
}

function formatTime(isoUtc: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(new Date(isoUtc));
}

function dayKey(isoUtc: string) {
  const d = new Date(isoUtc);
  return new Intl.DateTimeFormat("pt-BR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(d);
}

async function loadWeek(week: WeekBucket) {
  const res = await fetch(`/api/posts?week=${encodeURIComponent(week)}`, { cache: "no-store" });
  const payload = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new Error(getErrorMessage(payload) ?? "Falha ao carregar calendário.");
  return ((payload as ListResponse | null)?.items ?? []) as Post[];
}

export function CalendarClient(props: { initialWeek?: WeekBucket }) {
  const [week, setWeek] = useState<WeekBucket>(props.initialWeek ?? getIsoWeekBucketUtc(new Date()));

  const weekStartUtc = useMemo(() => getIsoWeekStartUtc(week) ?? new Date(), [week]);

  const query = useQuery({
    queryKey: ["calendar", week],
    queryFn: () => loadWeek(week),
    staleTime: 15_000,
  });

  const days = useMemo(() => {
    const start = getIsoWeekStartUtc(week);
    if (!start) return [];
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      return d;
    });
  }, [week]);

  const grouped = useMemo(() => {
    const items = query.data ?? [];
    const map = new Map<string, Post[]>();
    for (const p of items) {
      if (!p.scheduledAtUtc) continue;
      const k = dayKey(p.scheduledAtUtc);
      const list = map.get(k) ?? [];
      list.push(p);
      map.set(k, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.scheduledAtUtc ?? "").localeCompare(b.scheduledAtUtc ?? ""));
    }
    return map;
  }, [query.data]);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Calendário</h1>
          <p className="text-muted-foreground text-sm">
            Semana {week} (horário {tz})
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setWeek(getIsoWeekBucketUtc(addWeeksUtc(weekStartUtc, -1)))}
          >
            ←
          </Button>
          <Button
            variant="secondary"
            onClick={() => setWeek(getIsoWeekBucketUtc(addWeeksUtc(weekStartUtc, 1)))}
          >
            →
          </Button>
        </div>
      </div>

      {query.isError && (
        <p className="text-destructive text-sm">
          {(query.error as Error)?.message ?? "Falha ao carregar calendário."}
        </p>
      )}

      {query.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (query.data?.length ?? 0) === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nenhum post agendado nesta semana</EmptyTitle>
            <EmptyDescription>
              Quando você agendar posts, eles aparecem aqui organizados por dia.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {days.map((d) => {
            const k = dayKey(d.toISOString());
            const list = grouped.get(k) ?? [];
            return (
              <Card key={k} className="p-4">
                <div className="mb-3 text-sm font-medium">{formatDayLabel(d)}</div>
                {list.length === 0 ? (
                  <div className="text-muted-foreground text-sm">Sem posts</div>
                ) : (
                  <div className="space-y-3">
                    {list.map((p) => (
                      <div key={p.postId} className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{formatTime(p.scheduledAtUtc!)}</span>
                          <span className="text-muted-foreground">{p.status}</span>
                        </div>
                        <div className="text-sm line-clamp-2">{p.caption}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


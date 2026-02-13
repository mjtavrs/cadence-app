"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Page, PageActions, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type { WeekBucket } from "./recife-time";
import { getIsoWeekBucketRecife, getIsoWeekStartRecife, getMonthBucketRecife, getRecifePartsFromUtcDate } from "./recife-time";
import { addWeeksUtc } from "./calendar-utils";
import { monthBucketToLabelPtBr, type MonthBucket } from "./month-utils";
import { WeekCalendarView } from "./week-view";
import { MonthInfiniteCalendarView } from "./month-infinite-view";

export function CalendarClient(props: { initialWeek?: WeekBucket }) {
  const [view, setView] = useState<"week" | "month">("week");
  const [week, setWeek] = useState<WeekBucket>(
    props.initialWeek ?? getIsoWeekBucketRecife(new Date())
  );
  const [monthDateUtc] = useState<Date>(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12, 0, 0));
  });
  const [activeMonth, setActiveMonth] = useState<MonthBucket>(() =>
    getMonthBucketRecife(new Date()) as MonthBucket
  );

  const weekStartRecife = useMemo(() => getIsoWeekStartRecife(week) ?? new Date(), [week]);
  const monthBucket = useMemo(
    () => (getMonthBucketRecife(new Date()) as MonthBucket),
    []
  );

  const weekNumber = useMemo(() => {
    const [, weekStr] = week.split("-W");
    return Number(weekStr);
  }, [week]);

  const monthYearLabel = useMemo(() => {
    let label: string;
    if (view === "week") {
      const parts = getRecifePartsFromUtcDate(weekStartRecife);
      if (!parts) return "Calendário";
      const d = new Date(Date.UTC(parts.year, parts.month - 1, 1, 12, 0, 0));
      label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
    } else {
      label = monthBucketToLabelPtBr(activeMonth);
    }
    // Capitalizar primeira letra do mês
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [view, weekStartRecife, activeMonth]);

  return (
    <Page>
      <PageHeader>
        <PageHeaderText>
          <PageTitle className="flex items-center gap-2">
            {monthYearLabel}
            {view === "week" && (
              <span className="text-muted-foreground text-sm font-normal">
                Semana {weekNumber}
              </span>
            )}
          </PageTitle>
        </PageHeaderText>
        <PageActions>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => {
              if (v === "week" || v === "month") {
                setView(v);
                if (v === "month") setActiveMonth(monthBucket);
              }
            }}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Alternar visão do calendário"
          >
            <ToggleGroupItem value="week">Semanal</ToggleGroupItem>
            <ToggleGroupItem value="month">Mensal</ToggleGroupItem>
          </ToggleGroup>

          {view === "week" ? (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  setWeek(
                    getIsoWeekBucketRecife(addWeeksUtc(weekStartRecife, -1))
                  )
                }
              >
                ←
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  setWeek(getIsoWeekBucketRecife(addWeeksUtc(weekStartRecife, 1)))
                }
              >
                →
              </Button>
            </>
          ) : null}
        </PageActions>
      </PageHeader>

      {view === "week" ? (
        <WeekCalendarView week={week} />
      ) : (
        <MonthInfiniteCalendarView
          initialMonth={monthBucket}
          onActiveMonthChange={(m) => {
            setActiveMonth(m);
          }}
        />
      )}
    </Page>
  );
}


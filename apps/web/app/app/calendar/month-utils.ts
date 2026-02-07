"use client";

import { getIsoWeekBucketUtc, type WeekBucket } from "./calendar-utils";

export type MonthBucket = `${number}-${string}`; // YYYY-MM

export function getMonthBucketUtc(date: Date): MonthBucket {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}` as MonthBucket;
}

export function addMonthsUtc(dateUtc: Date, months: number) {
  const d = new Date(Date.UTC(dateUtc.getUTCFullYear(), dateUtc.getUTCMonth() + months, 1, 12, 0, 0));
  return d;
}

export function getMonthGridStartUtc(monthDateUtc: Date) {
  // monthDateUtc: qualquer dia dentro do mês, em UTC.
  const first = new Date(Date.UTC(monthDateUtc.getUTCFullYear(), monthDateUtc.getUTCMonth(), 1, 12, 0, 0));
  // Start Monday (ISO). getUTCDay: Sun=0..Sat=6 -> ISO Mon=1..Sun=7
  const dayNum = first.getUTCDay() || 7;
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - (dayNum - 1));
  return start;
}

export function buildMonthGridUtc(monthDateUtc: Date) {
  const start = getMonthGridStartUtc(monthDateUtc);
  // 6 semanas (42 células) para manter layout estável.
  return Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d;
  });
}

export function monthBucketToLabelPtBr(monthBucket: MonthBucket) {
  const [y, m] = monthBucket.split("-");
  const year = Number(y);
  const month = Number(m);
  const d = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

export function monthToWeeks(monthDateUtc: Date): WeekBucket[] {
  // Útil para compat/depuração. Preferimos endpoint month.
  const days = buildMonthGridUtc(monthDateUtc);
  const weeks = new Set<WeekBucket>();
  for (const d of days) {
    weeks.add(getIsoWeekBucketUtc(d));
  }
  return Array.from(weeks);
}


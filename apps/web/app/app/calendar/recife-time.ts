"use client";

// Recife é UTC-3 (sem DST). Usamos offset fixo para evitar inconsistências de timezone/ICU
// e garantir que o calendário seja determinístico.

const RECIFE_OFFSET_MS = -3 * 60 * 60 * 1000; // local = utc + offset

export type RecifeParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
};

export function getRecifePartsFromUtcDate(utcDate: Date): RecifeParts | null {
  if (Number.isNaN(utcDate.getTime())) return null;
  const local = new Date(utcDate.getTime() + RECIFE_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
}

export function getRecifePartsFromIsoUtc(isoUtc: string): RecifeParts | null {
  const utc = new Date(isoUtc);
  return getRecifePartsFromUtcDate(utc);
}

export function recifeDayKey(parts: { year: number; month: number; day: number }) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function recifeDayKeyFromIsoUtc(isoUtc: string) {
  const p = getRecifePartsFromIsoUtc(isoUtc);
  if (!p) return null;
  return recifeDayKey(p);
}

export function recifeDayKeyFromUtcDate(utcDate: Date) {
  const p = getRecifePartsFromUtcDate(utcDate);
  if (!p) return null;
  return recifeDayKey(p);
}

export function formatRecifeTimeFromIsoUtc(isoUtc: string) {
  const p = getRecifePartsFromIsoUtc(isoUtc);
  if (!p) return "??:??";
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function recifeMonthBucketFromIsoUtc(isoUtc: string) {
  const p = getRecifePartsFromIsoUtc(isoUtc);
  if (!p) return null;
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export type WeekBucket = `${number}-W${string}`;

export function getIsoWeekBucketRecife(date: Date): WeekBucket {
  const p = getRecifePartsFromUtcDate(date);
  if (!p) return "1970-W01";
  const { year, month, day } = p;
  const midnightRecife = new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
  const isoDay = midnightRecife.getUTCDay() || 7;
  const monday = new Date(midnightRecife);
  monday.setUTCDate(midnightRecife.getUTCDate() - (isoDay - 1));
  const jan4 = new Date(Date.UTC(monday.getUTCFullYear(), 0, 4, 3, 0, 0));
  const jan4Iso = jan4.getUTCDay() || 7;
  const jan4Monday = new Date(jan4);
  jan4Monday.setUTCDate(jan4.getUTCDate() - (jan4Iso - 1));
  const weekNo =
    Math.floor((monday.getTime() - jan4Monday.getTime()) / (7 * 86400000)) + 1;
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const weekYear = thursday.getUTCFullYear();
  return `${weekYear}-W${String(weekNo).padStart(2, "0")}` as WeekBucket;
}

export function getIsoWeekStartRecife(weekBucket: WeekBucket): Date | null {
  const [yearStr, weekStr] = weekBucket.split("-W");
  const year = Number(yearStr);
  const week = Number(weekStr);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53)
    return null;
  const jan4 = new Date(Date.UTC(year, 0, 4, 3, 0, 0));
  const jan4Iso = jan4.getUTCDay() || 7;
  const jan4Monday = new Date(jan4);
  jan4Monday.setUTCDate(jan4.getUTCDate() - (jan4Iso - 1));
  const monday = new Date(jan4Monday);
  monday.setUTCDate(jan4Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

export function getMonthBucketRecife(date: Date): string {
  const bucket = recifeMonthBucketFromIsoUtc(date.toISOString());
  return bucket ?? "";
}


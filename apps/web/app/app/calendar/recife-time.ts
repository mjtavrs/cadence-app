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


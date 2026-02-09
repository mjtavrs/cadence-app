/**
 * Agendamento e buckets de calendário — Recife-first (America/Recife, UTC-3).
 *
 * - scheduledAtUtc: sempre armazenado em ISO UTC.
 * - weekBucket e monthBucket: sempre calculados em Recife (semana ISO e mês civil em Recife).
 * - Queries de listagem (calendário) usam month/week em Recife; GSI2 e GSI4 usam esses buckets.
 */

import { MEDIA } from "../media/limits";

const RECIFE_OFFSET_MS = -3 * 60 * 60 * 1000;

function toRecifeParts(isoUtc: string): { year: number; month: number; day: number } | null {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return null;
  const local = new Date(d.getTime() + RECIFE_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
  };
}

export function normalizeCaption(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed;
}

export function isValidSingleMedia(mediaIds: string[]) {
  return Array.isArray(mediaIds) && mediaIds.length === 1 && typeof mediaIds[0] === "string" && mediaIds[0].trim();
}

export function parseUtcIso(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const iso = d.toISOString();
  return iso;
}

export function isAlignedToMinutes(isoUtc: string, stepMinutes: number) {
  const d = new Date(isoUtc);
  return d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0 && d.getUTCMinutes() % stepMinutes === 0;
}

export function computeWeekBucketRecife(isoUtc: string): string {
  const parts = toRecifeParts(isoUtc);
  if (!parts) return "";
  const { year, month, day } = parts;
  const midnightRecife = new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
  const isoDay = midnightRecife.getUTCDay() || 7;
  const monday = new Date(midnightRecife);
  monday.setUTCDate(midnightRecife.getUTCDate() - (isoDay - 1));
  const jan4 = new Date(Date.UTC(monday.getUTCFullYear(), 0, 4, 3, 0, 0));
  const jan4Iso = jan4.getUTCDay() || 7;
  const jan4Monday = new Date(jan4);
  jan4Monday.setUTCDate(jan4.getUTCDate() - (jan4Iso - 1));
  const weekNo = Math.floor((monday.getTime() - jan4Monday.getTime()) / (7 * 86400000)) + 1;
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const weekYear = thursday.getUTCFullYear();
  return `${weekYear}-W${String(weekNo).padStart(2, "0")}`;
}

export function computeMonthBucketRecife(isoUtc: string): string {
  const parts = toRecifeParts(isoUtc);
  if (!parts) return "";
  const { year, month } = parts;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function computeWeekBucketUtc(isoUtc: string) {
  const d = new Date(isoUtc);
  const year = d.getUTCFullYear();
  const week = getIsoWeekNumberUtc(d);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function computeMonthBucketUtc(isoUtc: string) {
  const d = new Date(isoUtc);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getIsoWeekNumberUtc(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}


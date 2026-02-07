import { MEDIA } from "../media/limits";

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

export function computeWeekBucketUtc(isoUtc: string) {
  // MVP: bucket em UTC. Depois evoluímos para timezone do workspace.
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

export function computeMonthBucketRecife(isoUtc: string) {
  // Recife é UTC-3 (sem DST). Para UX do calendário, o "mês" deve seguir o local.
  const d = new Date(isoUtc);
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
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


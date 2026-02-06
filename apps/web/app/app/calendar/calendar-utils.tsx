"use client";

export type WeekBucket = `${number}-W${string}`;

export function getIsoWeekBucketUtc(date: Date): WeekBucket {
  const year = date.getUTCFullYear();
  const week = getIsoWeekNumberUtc(date);
  return `${year}-W${String(week).padStart(2, "0")}` as WeekBucket;
}

export function getIsoWeekStartUtc(weekBucket: WeekBucket) {
  const [yearStr, weekStr] = weekBucket.split("-W");
  const year = Number(yearStr);
  const week = Number(weekStr);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;

  // ISO week 1 is the week containing Jan 4th.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayNum = jan4.getUTCDay() || 7; // Mon=1..Sun=7
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (dayNum - 1));

  const mondayTarget = new Date(mondayWeek1);
  mondayTarget.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return mondayTarget;
}

export function addWeeksUtc(dateUtc: Date, weeks: number) {
  const d = new Date(dateUtc);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d;
}

function getIsoWeekNumberUtc(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}


const TZ = "America/Recife";

type DateParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
};

type TimeParts = {
  hour: number; // 0-23
  minute: number; // 0-59
};

// Recife é UTC-3 (sem DST). Para agendamento no MVP, usamos conversão determinística:
// UTC = Recife + 3h. Isso evita inconsistências e bugs com heurísticas de timezone.
const RECIFE_UTC_OFFSET_MINUTES = -180;

function getParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const map = new Map(parts.map((p) => [p.type, p.value]));

  const year = Number(map.get("year"));
  const month = Number(map.get("month"));
  const day = Number(map.get("day"));
  const hour = Number(map.get("hour"));
  const minute = Number(map.get("minute"));
  const second = Number(map.get("second"));

  if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
    throw new Error("Falha ao ler data/hora no timezone.");
  }

  return { year, month, day, hour, minute, second } as const;
}

function ymdFrom(date: Date, timeZone: string): DateParts {
  const p = getParts(date, timeZone);
  return { year: p.year, month: p.month, day: p.day };
}

export function formatYmdPtBr(date: Date, timeZone: string = TZ) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function makeTimeOptions(
  stepMinutes: number,
  minHour: number = 0,
  maxHour: number = 24
) {
  const options: string[] = [];
  const minH = Math.max(0, Math.min(24, minHour));
  const maxH = Math.max(0, Math.min(24, maxHour));
  for (let h = minH; h < maxH; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}

export function isAlignedToMinutes(value: string, minutes: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const mm = Number(match[2]);
  return Number.isFinite(mm) && mm % minutes === 0;
}

export function getTodayForCalendar(timeZone: string = TZ) {
  const now = new Date();
  const { year, month, day } = ymdFrom(now, timeZone);
  // Usa "meio-dia UTC" para evitar borda de dia.
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function getNextQuarterSlotInTimeZone(now: Date = new Date(), timeZone: string = TZ) {
  const p = getParts(now, timeZone);

  let hour = p.hour;
  let minute = p.minute;

  const remainder = minute % 15;
  if (remainder !== 0) minute += 15 - remainder;
  if (minute === 60) {
    minute = 0;
    hour += 1;
  }

  // Se virou o dia, avança a data.
  const ymd = { year: p.year, month: p.month, day: p.day };
  if (hour >= 24) {
    hour = 0;
    const d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12, 0, 0));
    d.setUTCDate(d.getUTCDate() + 1);
    const advanced = ymdFrom(d, timeZone);
    ymd.year = advanced.year;
    ymd.month = advanced.month;
    ymd.day = advanced.day;
  }

  const SCHEDULE_MIN_HOUR = 6;
  const SCHEDULE_MAX_HOUR = 22;
  if (hour < SCHEDULE_MIN_HOUR) hour = SCHEDULE_MIN_HOUR;
  if (hour > SCHEDULE_MAX_HOUR) hour = SCHEDULE_MAX_HOUR;
  if (hour === SCHEDULE_MAX_HOUR && minute > 0) minute = 0;

  const dateForCalendar = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12, 0, 0));
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return { dateForCalendar, time } as const;
}

function recifeLocalToUtc(date: DateParts, time: TimeParts) {
  // local = utc + offset  =>  utc = local - offset
  // offset Recife = -180min => utc = local + 180min
  const utcHour = time.hour - RECIFE_UTC_OFFSET_MINUTES / 60;
  const utcMs = Date.UTC(date.year, date.month - 1, date.day, utcHour, time.minute, 0, 0);
  return new Date(utcMs);
}

export function buildUtcIsoFromRecifeSelection(params: {
  selectedDate: Date;
  timeHHmm: string;
  timeZone?: string;
}) {
  const timeZone = params.timeZone ?? TZ;
  if (timeZone !== TZ) {
    throw new Error(`Timezone não suportado no MVP: ${timeZone}`);
  }

  const ymd = ymdFrom(params.selectedDate, timeZone);
  const match = /^(\d{2}):(\d{2})$/.exec(params.timeHHmm);
  if (!match) throw new Error("Horário inválido.");

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) throw new Error("Horário inválido.");

  const utc = recifeLocalToUtc(ymd, { hour, minute });
  return utc.toISOString();
}

export function formatRecifeDateTimeShort(isoUtc: string, timeZone: string = TZ) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoUtc));
}

export function formatDateForSection(isoUtc: string, timeZone: string = TZ): string {
  const date = new Date(isoUtc);
  const today = getTodayForCalendar(timeZone);
  const todayParts = ymdFrom(today, timeZone);
  const dateParts = ymdFrom(date, timeZone);

  const isToday =
    dateParts.year === todayParts.year &&
    dateParts.month === todayParts.month &&
    dateParts.day === todayParts.day;

  if (isToday) return "Hoje";

  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowParts = ymdFrom(tomorrow, timeZone);
  const isTomorrow =
    dateParts.year === tomorrowParts.year &&
    dateParts.month === tomorrowParts.month &&
    dateParts.day === tomorrowParts.day;

  if (isTomorrow) return "Amanhã";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}export function formatDateAndTime(isoUtc: string, timeZone: string = TZ): string {
  const parts = getParts(new Date(isoUtc), timeZone);
  const dateStr = formatYmdPtBr(new Date(isoUtc), timeZone);
  const timeStr = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  return `${dateStr} • ${timeStr}`;
}

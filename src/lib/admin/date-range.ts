import { business } from "@/config/business";

const DAY_MS = 86_400_000;

function partsAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function offsetMs(date: Date, timeZone: string) {
  const p = partsAt(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

export function zonedDateTimeToUtc(dateString: string, time = "00:00:00", timeZone = business.timezone) {
  const [y, m, d] = dateString.split("-").map(Number);
  const [hh, mm, ss] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm, ss || 0);
  let guess = new Date(naive);
  let offset = offsetMs(guess, timeZone);
  guess = new Date(naive - offset);
  const secondOffset = offsetMs(guess, timeZone);
  if (secondOffset !== offset) guess = new Date(naive - secondOffset);
  return guess;
}

export function localTimeKey(date: Date, timeZone = business.timezone) {
  const p = partsAt(date, timeZone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function localDateKey(date: Date, timeZone = business.timezone) {
  const p = partsAt(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function parseAdminRange(from?: string, to?: string) {
  const now = new Date();
  const today = localDateKey(now);
  const defaultFrom = localDateKey(new Date(now.getTime() - 29 * DAY_MS));
  const isDate = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  const fromDate = isDate(from) ? from! : defaultFrom;
  const toDate = isDate(to) ? to! : today;
  const start = zonedDateTimeToUtc(fromDate, "00:00:00");
  const endInclusive = zonedDateTimeToUtc(toDate, "23:59:59");
  const days = Math.ceil((endInclusive.getTime() - start.getTime()) / DAY_MS);
  if (endInclusive < start || days > 366) {
    return parseAdminRange(defaultFrom, today);
  }
  return { from: fromDate, to: toDate, start, end: new Date(endInclusive.getTime() + 999), days: days + 1 };
}

export function formatLocalDateTime(date: Date, locale = "en-GB") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: business.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

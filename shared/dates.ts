import type { Weekday } from "./types";
import { WEEKDAYS } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday is 1 and Sunday is 7, matching the template's Streak formula. */
export function weekdayIndexMon1(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const sun0 = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return sun0 === 0 ? 7 : sun0;
}

export function weekdayName(iso: string): Weekday {
  return WEEKDAYS[weekdayIndexMon1(iso) - 1];
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const sun0 = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${SHORT_DAYS[sun0]} ${d} ${MONTHS[m - 1]}`;
}

export function formatHeadingDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);
  return `${weekday}, ${d} ${MONTHS[m - 1]}`;
}

export function formatReleased(iso: string | null): string {
  const suffix = "takes about 2 minutes, no coding";
  if (!iso) return `Released recently · ${suffix}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return `Released recently · ${suffix}`;
  return `Released ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} · ${suffix}`;
}

export function inLast7Days(date: string | null, today: string): boolean {
  if (!date || !isIsoDate(date) || !isIsoDate(today)) return false;
  return date >= shiftIso(today, -6) && date <= today;
}

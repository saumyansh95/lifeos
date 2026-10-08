import type { Weekday } from "./types";
import { WEEKDAYS } from "./types";
import { weekdayIndexMon1 } from "./dates";

/**
 * The template's Streak formula:
 * days = [Mon … Sun]
 * take the days up to today, walk backward, and if today is still unticked
 * start from yesterday. Count the run of ticks.
 */
export function streakFromDays(days: boolean[], isoToday: string): number {
  const t = weekdayIndexMon1(isoToday);
  const recent = days.slice(0, t).reverse();
  const run = recent[0] ? recent : recent.slice(1);
  const broken = run.findIndex((ticked) => !ticked);
  return broken === -1 ? run.length : broken;
}

export function emptyDays(): Record<Weekday, boolean> {
  return { Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false, Sun: false };
}

export function dayFlags(days: Record<Weekday, boolean>): boolean[] {
  return WEEKDAYS.map((day) => Boolean(days[day]));
}

/** Reads "🔥 3 days" or "—" from the template formula. Null when there is no formula value. */
export function parseStreakText(value: string | null | undefined): number | null {
  if (value == null) return null;
  const match = value.match(/(\d+)/);
  if (!match) return 0;
  return Number(match[1]);
}

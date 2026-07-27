import {
  DEFAULT_CLOSE_HOUR,
  DEFAULT_OPEN_HOUR,
} from "@/app/_lib/bookings/constants";

export type WeeklyDayHours = {
  dayOfWeek: number;
  isOpen: boolean;
  openHour: number;
  closeHour: number;
};

export const WEEKDAY_LABELS_IT = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
] as const;

/** 0 = lunedì … 6 = domenica, a partire da una data calendario YYYY-MM-DD. */
export function getIsoWeekdayFromDateStr(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function defaultWeeklyHours(): WeeklyDayHours[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: true,
    openHour: DEFAULT_OPEN_HOUR,
    closeHour: DEFAULT_CLOSE_HOUR,
  }));
}

export function weeklyHoursToMap(
  days: WeeklyDayHours[],
): Map<number, WeeklyDayHours> {
  return new Map(days.map((day) => [day.dayOfWeek, day]));
}

export function resolveWeeklyDaySchedule(
  dateStr: string,
  weeklyByDay: Map<number, WeeklyDayHours>,
): { closed: boolean; openHour: number; closeHour: number } {
  const dayOfWeek = getIsoWeekdayFromDateStr(dateStr);
  const day = weeklyByDay.get(dayOfWeek);

  if (!day || !day.isOpen) {
    return { closed: true, openHour: 0, closeHour: 0 };
  }

  return {
    closed: false,
    openHour: day.openHour,
    closeHour: day.closeHour,
  };
}

/** Elenco inclusivo di date YYYY-MM-DD tra start e end (max `maxDays`). */
export function enumerateDateRange(
  startDate: string,
  endDate: string,
  maxDays = 62,
): string[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  if (end < start) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end && dates.length < maxDays) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (cursor <= end) {
    return [];
  }

  return dates;
}

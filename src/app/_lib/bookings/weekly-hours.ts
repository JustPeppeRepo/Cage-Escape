import { prisma } from "@/app/_lib/prisma";
import {
  defaultWeeklyHours,
  type WeeklyDayHours,
} from "@/app/_lib/bookings/weekly-hours-shared";

export type { WeeklyDayHours } from "@/app/_lib/bookings/weekly-hours-shared";
export {
  WEEKDAY_LABELS_IT,
  getIsoWeekdayFromDateStr,
  weeklyHoursToMap,
  resolveWeeklyDaySchedule,
  enumerateDateRange,
} from "@/app/_lib/bookings/weekly-hours-shared";

/** Garantisce 7 righe e le restituisce ordinate per dayOfWeek. */
export async function ensureWeeklyOpeningHours(): Promise<WeeklyDayHours[]> {
  const existing = await prisma.weeklyOpeningHours.findMany({
    orderBy: { dayOfWeek: "asc" },
  });

  if (existing.length === 7) {
    return existing.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      isOpen: row.isOpen,
      openHour: row.openHour,
      closeHour: row.closeHour,
    }));
  }

  const byDay = new Map(existing.map((row) => [row.dayOfWeek, row]));
  const defaults = defaultWeeklyHours();

  await prisma.$transaction(
    defaults
      .filter((day) => !byDay.has(day.dayOfWeek))
      .map((day) =>
        prisma.weeklyOpeningHours.create({
          data: {
            dayOfWeek: day.dayOfWeek,
            isOpen: day.isOpen,
            openHour: day.openHour,
            closeHour: day.closeHour,
          },
        }),
      ),
  );

  const synced = await prisma.weeklyOpeningHours.findMany({
    orderBy: { dayOfWeek: "asc" },
  });

  return synced.map((row) => ({
    dayOfWeek: row.dayOfWeek,
    isOpen: row.isOpen,
    openHour: row.openHour,
    closeHour: row.closeHour,
  }));
}

import type { Prisma } from "@/generated/prisma/client";
import { BookingStatus, ScheduleOverrideType } from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import { getSlotCooldownMinutes } from "@/app/_lib/admin/site-settings";
import {
  DEFAULT_CLOSE_HOUR,
  DEFAULT_OPEN_HOUR,
  TIMEZONE,
} from "@/app/_lib/bookings/constants";
import {
  ensureWeeklyOpeningHours,
  resolveWeeklyDaySchedule,
  weeklyHoursToMap,
  type WeeklyDayHours,
} from "@/app/_lib/bookings/weekly-hours";

export type TimeSlot = {
  startTime: Date;
  endTime: Date;
};

export type DaySchedule = {
  closed: boolean;
  openHour: number;
  closeHour: number;
};

export type SerializedTimeSlot = {
  startTime: string;
  endTime: string;
};

type ScheduleOverrideRecord = {
  date: Date;
  roomId: string | null;
  type: ScheduleOverrideType;
  openHour: number | null;
  closeHour: number | null;
};

type TransactionClient = Prisma.TransactionClient;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
  };
}

export function getRomeDateString(date: Date): string {
  return getZonedParts(date, TIMEZONE).date;
}

export function createRomeDateTime(
  dateStr: string,
  hour: number,
  minute = 0,
): Date {
  const rough = Date.parse(
    `${dateStr}T${pad(hour)}:${pad(minute)}:00.000Z`,
  );

  for (let delta = -14 * 3_600_000; delta <= 14 * 3_600_000; delta += 60_000) {
    const candidate = new Date(rough + delta);
    const parts = getZonedParts(candidate, TIMEZONE);

    if (
      parts.date === dateStr &&
      parts.hour === hour &&
      parts.minute === minute &&
      parts.second === 0
    ) {
      return candidate;
    }
  }

  throw new Error(
    `Impossibile convertire ${dateStr} ${pad(hour)}:${pad(minute)} in ${TIMEZONE}`,
  );
}

export function getDayBounds(dateStr: string): { dayStart: Date; dayEnd: Date } {
  const dayStart = createRomeDateTime(dateStr, 0, 0);
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return { dayStart, dayEnd: nextDay };
}

export async function releaseExpiredHolds(
  tx: TransactionClient = prisma,
): Promise<number> {
  const result = await tx.booking.updateMany({
    where: {
      status: BookingStatus.PENDING,
      holdExpiresAt: { lt: new Date() },
    },
    data: {
      status: BookingStatus.CANCELLED,
      holdExpiresAt: null,
    },
  });

  return result.count;
}

function toUtcDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function defaultDaySchedule(): DaySchedule {
  return {
    closed: false,
    openHour: DEFAULT_OPEN_HOUR,
    closeHour: DEFAULT_CLOSE_HOUR,
  };
}

export function resolveDayScheduleFromOverrides(
  dateStr: string,
  roomId: string,
  overrides: ScheduleOverrideRecord[],
  weeklyByDay?: Map<number, WeeklyDayHours>,
): DaySchedule {
  const dateOnly = toUtcDateOnly(dateStr);
  const dayOverrides = overrides.filter(
    (item) => item.date.getTime() === dateOnly.getTime(),
  );

  const roomOverride = dayOverrides.find((item) => item.roomId === roomId);
  const globalOverride = dayOverrides.find((item) => item.roomId === null);
  const override = roomOverride ?? globalOverride;

  if (!override) {
    if (weeklyByDay) {
      return resolveWeeklyDaySchedule(dateStr, weeklyByDay);
    }
    return defaultDaySchedule();
  }

  if (override.type === ScheduleOverrideType.CLOSED) {
    return { closed: true, openHour: 0, closeHour: 0 };
  }

  if (
    override.type === ScheduleOverrideType.CUSTOM_HOURS &&
    override.openHour !== null &&
    override.closeHour !== null
  ) {
    return {
      closed: false,
      openHour: override.openHour,
      closeHour: override.closeHour,
    };
  }

  if (weeklyByDay) {
    return resolveWeeklyDaySchedule(dateStr, weeklyByDay);
  }

  return defaultDaySchedule();
}

export async function resolveDaySchedule(
  dateStr: string,
  roomId: string,
): Promise<DaySchedule> {
  const [overrides, weekly] = await Promise.all([
    prisma.scheduleOverride.findMany({
      where: {
        date: toUtcDateOnly(dateStr),
        OR: [{ roomId: null }, { roomId }],
      },
      orderBy: { roomId: "desc" },
    }),
    ensureWeeklyOpeningHours(),
  ]);

  return resolveDayScheduleFromOverrides(
    dateStr,
    roomId,
    overrides,
    weeklyHoursToMap(weekly),
  );
}

export function generateTimeSlots(
  dateStr: string,
  durationMinutes: number,
  openHour: number,
  closeHour: number,
  cooldownMinutes = 0,
): TimeSlot[] {
  if (openHour >= closeHour) {
    return [];
  }

  const slots: TimeSlot[] = [];
  let cursorHour = openHour;
  let cursorMinute = 0;
  const stepMinutes = durationMinutes + Math.max(0, cooldownMinutes);

  while (true) {
    const startTime = createRomeDateTime(dateStr, cursorHour, cursorMinute);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
    const endParts = getZonedParts(endTime, TIMEZONE);

    const endMinutes = endParts.hour * 60 + endParts.minute;
    const closeMinutes = closeHour * 60;

    if (endParts.date !== dateStr || endMinutes > closeMinutes) {
      break;
    }

    slots.push({ startTime, endTime });

    const nextStart = new Date(startTime.getTime() + stepMinutes * 60_000);
    const nextParts = getZonedParts(nextStart, TIMEZONE);

    if (nextParts.date !== dateStr) {
      break;
    }

    cursorHour = nextParts.hour;
    cursorMinute = nextParts.minute;
  }

  return slots;
}

function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && endA > startB;
}

function withCooldownEnd(endTime: Date, cooldownMinutes: number): Date {
  if (cooldownMinutes <= 0) {
    return endTime;
  }
  return new Date(endTime.getTime() + cooldownMinutes * 60_000);
}

export async function getOccupiedSlots(
  roomId: string,
  dayStart: Date,
  dayEnd: Date,
  tx: TransactionClient = prisma,
): Promise<TimeSlot[]> {
  const now = new Date();
  const cooldownMinutes = await getSlotCooldownMinutes();

  const bookings = await tx.booking.findMany({
    where: {
      roomId,
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
      OR: [
        { status: { in: [BookingStatus.PAID, BookingStatus.DEPOSIT_PAID] } },
        {
          status: BookingStatus.PENDING,
          holdExpiresAt: { gt: now },
        },
      ],
    },
    select: {
      startTime: true,
      endTime: true,
    },
  });

  return bookings.map((booking) => ({
    startTime: booking.startTime,
    endTime: withCooldownEnd(booking.endTime, cooldownMinutes),
  }));
}

export async function isSlotAvailable(
  roomId: string,
  startTime: Date,
  endTime: Date,
  tx: TransactionClient = prisma,
): Promise<boolean> {
  const now = new Date();
  const cooldownMinutes = await getSlotCooldownMinutes();
  const cooldownMs = Math.max(0, cooldownMinutes) * 60_000;

  // Intervallo busy = [start, end + cooldown). Confronto simmetrico con le
  // prenotazioni esistenti (anche se inserite in ordine inverso).
  const conflict = await tx.booking.findFirst({
    where: {
      roomId,
      startTime: { lt: new Date(endTime.getTime() + cooldownMs) },
      endTime: { gt: new Date(startTime.getTime() - cooldownMs) },
      OR: [
        { status: { in: [BookingStatus.PAID, BookingStatus.DEPOSIT_PAID] } },
        {
          status: BookingStatus.PENDING,
          holdExpiresAt: { gt: now },
        },
      ],
    },
    select: { id: true },
  });

  return conflict === null;
}

export function filterAvailableSlots(
  generated: TimeSlot[],
  occupied: TimeSlot[],
  cooldownMinutes = 0,
): TimeSlot[] {
  return generated.filter((slot) => {
    const slotBusyEnd = withCooldownEnd(slot.endTime, cooldownMinutes);
    return !occupied.some((booking) =>
      rangesOverlap(
        slot.startTime,
        slotBusyEnd,
        booking.startTime,
        booking.endTime,
      ),
    );
  });
}

function getBookableSlotsForDay(
  dateStr: string,
  durationMinutes: number,
  schedule: DaySchedule,
  occupied: TimeSlot[],
  now: Date,
  cooldownMinutes = 0,
): { bookable: TimeSlot[]; available: TimeSlot[] } {
  if (schedule.closed) {
    return { bookable: [], available: [] };
  }

  const generated = generateTimeSlots(
    dateStr,
    durationMinutes,
    schedule.openHour,
    schedule.closeHour,
    cooldownMinutes,
  );
  const bookable = generated.filter((slot) => slot.startTime > now);
  const available = filterAvailableSlots(bookable, occupied, cooldownMinutes);

  return { bookable, available };
}

export async function getAvailableSlotsForRoom(
  roomId: string,
  durationMinutes: number,
  dateStr: string,
): Promise<TimeSlot[]> {
  // Il vincolo EXCLUDE a DB tratta tutti i PENDING come occupanti, anche
  // con hold scaduto. Senza rilascio qui la UI mostrerebbe lo slot libero
  // (getOccupiedSlots ignora gli hold scaduti) ma il successivo insert
  // fallirebbe contro il PENDING zombie.
  await releaseExpiredHolds();

  const cooldownMinutes = await getSlotCooldownMinutes();

  const { dayStart, dayEnd } = getDayBounds(dateStr);
  const [schedule, occupied] = await Promise.all([
    resolveDaySchedule(dateStr, roomId),
    getOccupiedSlots(roomId, dayStart, dayEnd),
  ]);

  return getBookableSlotsForDay(
    dateStr,
    durationMinutes,
    schedule,
    occupied,
    new Date(),
    cooldownMinutes,
  ).available;
}

export async function getMonthClosedDates(
  roomId: string,
  year: number,
  month: number,
): Promise<string[]> {
  const todayRome = getRomeDateString(new Date());
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${pad(month + 1)}`;
  const startDateStr = `${monthPrefix}-01`;
  const endDateStr = `${monthPrefix}-${pad(lastDay)}`;

  const [overrides, weekly] = await Promise.all([
    prisma.scheduleOverride.findMany({
      where: {
        date: {
          gte: toUtcDateOnly(startDateStr),
          lte: toUtcDateOnly(endDateStr),
        },
        OR: [{ roomId: null }, { roomId }],
      },
      orderBy: { roomId: "desc" },
    }),
    ensureWeeklyOpeningHours(),
  ]);

  const weeklyByDay = weeklyHoursToMap(weekly);
  const closedDates: string[] = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const dateStr = `${monthPrefix}-${pad(day)}`;
    if (dateStr < todayRome) {
      continue;
    }

    const schedule = resolveDayScheduleFromOverrides(
      dateStr,
      roomId,
      overrides,
      weeklyByDay,
    );

    if (schedule.closed) {
      closedDates.push(dateStr);
    }
  }

  return closedDates;
}

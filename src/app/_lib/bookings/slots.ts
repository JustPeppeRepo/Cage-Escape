import type { Prisma } from "@/generated/prisma/client";
import { BookingStatus, ScheduleOverrideType } from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import {
  DEFAULT_CLOSE_HOUR,
  DEFAULT_OPEN_HOUR,
  TIMEZONE,
} from "@/app/_lib/bookings/constants";

export type TimeSlot = {
  startTime: Date;
  endTime: Date;
};

export type DaySchedule = {
  closed: boolean;
  openHour: number;
  closeHour: number;
};

export type DayAvailabilityStatus = "available" | "partial" | "unavailable";

export type SerializedTimeSlot = {
  startTime: string;
  endTime: string;
};

export type RoomAvailabilityRangeResult = {
  days: Record<string, DayAvailabilityStatus>;
  slotsByDate: Record<string, SerializedTimeSlot[]>;
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

export function resolveDayScheduleFromOverrides(
  dateStr: string,
  roomId: string,
  overrides: ScheduleOverrideRecord[],
): DaySchedule {
  const dateOnly = toUtcDateOnly(dateStr);
  const dayOverrides = overrides.filter(
    (item) => item.date.getTime() === dateOnly.getTime(),
  );

  const roomOverride = dayOverrides.find((item) => item.roomId === roomId);
  const globalOverride = dayOverrides.find((item) => item.roomId === null);
  const override = roomOverride ?? globalOverride;

  if (!override) {
    return {
      closed: false,
      openHour: DEFAULT_OPEN_HOUR,
      closeHour: DEFAULT_CLOSE_HOUR,
    };
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

  return {
    closed: false,
    openHour: DEFAULT_OPEN_HOUR,
    closeHour: DEFAULT_CLOSE_HOUR,
  };
}

export async function resolveDaySchedule(
  dateStr: string,
  roomId: string,
): Promise<DaySchedule> {
  const overrides = await prisma.scheduleOverride.findMany({
    where: {
      date: toUtcDateOnly(dateStr),
      OR: [{ roomId: null }, { roomId }],
    },
    orderBy: { roomId: "desc" },
  });

  return resolveDayScheduleFromOverrides(dateStr, roomId, overrides);
}

export function generateTimeSlots(
  dateStr: string,
  durationMinutes: number,
  openHour: number,
  closeHour: number,
): TimeSlot[] {
  if (openHour >= closeHour) {
    return [];
  }

  const slots: TimeSlot[] = [];
  let cursorHour = openHour;
  let cursorMinute = 0;

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

    cursorHour = endParts.hour;
    cursorMinute = endParts.minute;
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

export async function getOccupiedSlots(
  roomId: string,
  dayStart: Date,
  dayEnd: Date,
  tx: TransactionClient = prisma,
): Promise<TimeSlot[]> {
  const now = new Date();

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

  return bookings;
}

export async function isSlotAvailable(
  roomId: string,
  startTime: Date,
  endTime: Date,
  tx: TransactionClient = prisma,
): Promise<boolean> {
  const now = new Date();

  const conflict = await tx.booking.findFirst({
    where: {
      roomId,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
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
): TimeSlot[] {
  return generated.filter((slot) =>
    !occupied.some((booking) =>
      rangesOverlap(
        slot.startTime,
        slot.endTime,
        booking.startTime,
        booking.endTime,
      ),
    ),
  );
}

function getBookableSlotsForDay(
  dateStr: string,
  durationMinutes: number,
  schedule: DaySchedule,
  occupied: TimeSlot[],
  now: Date,
): { bookable: TimeSlot[]; available: TimeSlot[] } {
  if (schedule.closed) {
    return { bookable: [], available: [] };
  }

  const generated = generateTimeSlots(
    dateStr,
    durationMinutes,
    schedule.openHour,
    schedule.closeHour,
  );
  const bookable = generated.filter((slot) => slot.startTime > now);
  const available = filterAvailableSlots(bookable, occupied);

  return { bookable, available };
}

function serializeTimeSlots(slots: TimeSlot[]): SerializedTimeSlot[] {
  return slots.map((slot) => ({
    startTime: slot.startTime.toISOString(),
    endTime: slot.endTime.toISOString(),
  }));
}

export async function getAvailableSlotsForRoom(
  roomId: string,
  durationMinutes: number,
  dateStr: string,
): Promise<TimeSlot[]> {
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
  ).available;
}

export function getDefaultPrefetchRangeBounds(): {
  startDateStr: string;
  endDateStr: string;
} {
  const todayRome = getRomeDateString(new Date());
  const [year, month] = todayRome.split("-").map(Number);
  const monthStart = `${year}-${pad(month)}-01`;
  const startDateStr = todayRome > monthStart ? todayRome : monthStart;

  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  const lastDay = new Date(nextYear, nextMonth, 0).getDate();
  const endDateStr = `${nextYear}-${pad(nextMonth)}-${pad(lastDay)}`;

  return { startDateStr, endDateStr };
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

export async function getRoomAvailabilityRange(
  roomId: string,
  durationMinutes: number,
  startDateStr: string,
  endDateStr: string,
  options?: { skipReleaseExpiredHolds?: boolean },
): Promise<RoomAvailabilityRangeResult> {
  if (!options?.skipReleaseExpiredHolds) {
    await releaseExpiredHolds();
  }

  const todayRome = getRomeDateString(new Date());
  const now = new Date();
  const { dayStart: rangeStart } = getDayBounds(startDateStr);
  const { dayEnd: rangeEnd } = getDayBounds(endDateStr);

  const [overrides, occupied] = await Promise.all([
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
    getOccupiedSlots(roomId, rangeStart, rangeEnd),
  ]);

  const days: Record<string, DayAvailabilityStatus> = {};
  const slotsByDate: Record<string, SerializedTimeSlot[]> = {};

  for (
    let dateStr = startDateStr;
    dateStr <= endDateStr;
    dateStr = addDaysToDateStr(dateStr, 1)
  ) {
    if (dateStr < todayRome) {
      continue;
    }

    const schedule = resolveDayScheduleFromOverrides(
      dateStr,
      roomId,
      overrides,
    );
    const { dayStart, dayEnd } = getDayBounds(dateStr);
    const dayOccupied = occupied.filter(
      (booking) =>
        booking.startTime < dayEnd && booking.endTime > dayStart,
    );
    const { bookable, available } = getBookableSlotsForDay(
      dateStr,
      durationMinutes,
      schedule,
      dayOccupied,
      now,
    );

    slotsByDate[dateStr] = serializeTimeSlots(available);

    if (bookable.length === 0) {
      days[dateStr] = "unavailable";
      continue;
    }

    if (available.length === 0) {
      days[dateStr] = "unavailable";
      continue;
    }

    days[dateStr] = dayOccupied.length > 0 ? "partial" : "available";
  }

  return { days, slotsByDate };
}

export async function getRoomMonthAvailability(
  roomId: string,
  durationMinutes: number,
  year: number,
  month: number,
): Promise<Record<string, DayAvailabilityStatus>> {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${pad(month + 1)}`;
  const startDateStr = `${monthPrefix}-01`;
  const endDateStr = `${monthPrefix}-${pad(lastDay)}`;

  const { days } = await getRoomAvailabilityRange(
    roomId,
    durationMinutes,
    startDateStr,
    endDateStr,
  );

  return days;
}

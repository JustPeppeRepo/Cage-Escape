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

export async function resolveDaySchedule(
  dateStr: string,
  roomId: string,
): Promise<DaySchedule> {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dateOnly = new Date(Date.UTC(year, month - 1, day));

  const overrides = await prisma.scheduleOverride.findMany({
    where: {
      date: dateOnly,
      OR: [{ roomId: null }, { roomId }],
    },
    orderBy: { roomId: "desc" },
  });

  const roomOverride = overrides.find((item) => item.roomId === roomId);
  const globalOverride = overrides.find((item) => item.roomId === null);
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

export async function getAvailableSlotsForRoom(
  roomId: string,
  durationMinutes: number,
  dateStr: string,
): Promise<TimeSlot[]> {
  await releaseExpiredHolds();

  const schedule = await resolveDaySchedule(dateStr, roomId);
  if (schedule.closed) {
    return [];
  }

  const generated = generateTimeSlots(
    dateStr,
    durationMinutes,
    schedule.openHour,
    schedule.closeHour,
  );

  const { dayStart, dayEnd } = getDayBounds(dateStr);
  const occupied = await getOccupiedSlots(roomId, dayStart, dayEnd);

  return filterAvailableSlots(generated, occupied);
}

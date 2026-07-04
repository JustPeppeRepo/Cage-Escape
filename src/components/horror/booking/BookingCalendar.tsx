"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayAvailabilityStatus } from "@/app/_lib/bookings/slots";

type BookingCalendarProps = {
  selectedDate: string | null;
  dayAvailability: Record<string, DayAvailabilityStatus>;
  isLoadingAvailability?: boolean;
  onSelectDate: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
  onDayHover?: (date: string) => void;
};

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTH_LABELS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

const MAX_MONTHS_AHEAD = 2;

type DayCell = {
  date: Date;
  dateStr: string;
};

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function monthHasAvailabilityData(
  dayAvailability: Record<string, DayAvailabilityStatus>,
  year: number,
  month: number,
): boolean {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  return Object.keys(dayAvailability).some((date) => date.startsWith(prefix));
}

function getDayButtonClassName({
  isPast,
  isSelected,
  availability,
}: {
  isPast: boolean;
  isSelected: boolean;
  availability?: DayAvailabilityStatus;
}): string {
  if (isSelected) {
    return "bg-blood text-bone";
  }

  if (isPast) {
    return "cursor-not-allowed text-bone/20";
  }

  if (availability === "unavailable") {
    return "cursor-not-allowed bg-blood/20 text-bone/30";
  }

  if (availability === "partial") {
    return "bg-amber-700/25 text-amber-100/85 hover:bg-amber-700/35 hover:text-amber-50";
  }

  return "text-bone/80 hover:bg-blood/20 hover:text-bone";
}

export function BookingCalendar({
  selectedDate,
  dayAvailability,
  isLoadingAvailability = false,
  onSelectDate,
  onMonthChange,
  onDayHover,
}: BookingCalendarProps) {
  const today = useMemo(() => startOfToday(), []);
  const minMonth = useMemo(() => startOfMonth(today), [today]);
  const maxMonth = useMemo(() => {
    const max = startOfMonth(today);
    max.setMonth(max.getMonth() + MAX_MONTHS_AHEAD);
    return max;
  }, [today]);

  const [viewedMonth, setViewedMonth] = useState(minMonth);

  useEffect(() => {
    const year = viewedMonth.getFullYear();
    const month = viewedMonth.getMonth();

    if (monthHasAvailabilityData(dayAvailability, year, month)) {
      return;
    }

    onMonthChange(year, month);
  }, [viewedMonth, onMonthChange, dayAvailability]);

  const canGoPrev = viewedMonth.getTime() > minMonth.getTime();
  const canGoNext = viewedMonth.getTime() < maxMonth.getTime();

  const days = useMemo<Array<DayCell | null>>(() => {
    const firstDay = startOfMonth(viewedMonth);
    const lastDay = new Date(
      viewedMonth.getFullYear(),
      viewedMonth.getMonth() + 1,
      0,
    );
    const leadingBlanks = (firstDay.getDay() + 6) % 7;

    const cells: Array<DayCell | null> = Array.from(
      { length: leadingBlanks },
      () => null,
    );

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(
        viewedMonth.getFullYear(),
        viewedMonth.getMonth(),
        day,
      );
      cells.push({ date, dateStr: toDateString(date) });
    }

    return cells;
  }, [viewedMonth]);

  function handlePrev() {
    if (!canGoPrev) return;
    setViewedMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
    );
  }

  function handleNext() {
    if (!canGoNext) return;
    setViewedMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
    );
  }

  return (
    <div className="w-full rounded-md border border-void-mist bg-void-deep p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrev}
          disabled={!canGoPrev}
          aria-label="Mese precedente"
          className="rounded px-2.5 py-1.5 text-sm text-bone/70 transition-colors hover:bg-blood/20 hover:text-bone disabled:cursor-not-allowed disabled:opacity-30"
        >
          ←
        </button>
        <span className="font-[family-name:var(--font-display)] text-lg text-bone sm:text-xl">
          {MONTH_LABELS[viewedMonth.getMonth()]} {viewedMonth.getFullYear()}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoNext}
          aria-label="Mese successivo"
          className="rounded px-2.5 py-1.5 text-sm text-bone/70 transition-colors hover:bg-blood/20 hover:text-bone disabled:cursor-not-allowed disabled:opacity-30"
        >
          →
        </button>
      </div>

      {isLoadingAvailability ? (
        <p className="mb-3 text-xs text-bone/50">Aggiornamento disponibilità…</p>
      ) : null}

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-bone/50 sm:text-sm">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-1">
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((cell, index) => {
          if (!cell) {
            return <span key={`blank-${index}`} aria-hidden="true" />;
          }

          const isPast = cell.date.getTime() < today.getTime();
          const availability = dayAvailability[cell.dateStr];
          const isUnavailable = !isPast && availability === "unavailable";
          const isSelected = cell.dateStr === selectedDate;
          const isDisabled = isPast || isUnavailable;

          return (
            <button
              key={cell.dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDate(cell.dateStr)}
              onMouseEnter={() => {
                if (!isDisabled) {
                  onDayHover?.(cell.dateStr);
                }
              }}
              onFocus={() => {
                if (!isDisabled) {
                  onDayHover?.(cell.dateStr);
                }
              }}
              className={`flex aspect-square w-full items-center justify-center rounded text-sm transition-colors sm:text-base ${getDayButtonClassName(
                {
                  isPast,
                  isSelected,
                  availability,
                },
              )}`}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-bone/50">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-amber-700/25 ring-1 ring-amber-700/30" />
          Parzialmente occupato
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-blood/20 ring-1 ring-blood/30" />
          Non prenotabile
        </span>
      </div>
    </div>
  );
}

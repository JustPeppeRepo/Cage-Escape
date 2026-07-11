"use client";

import { useEffect, useMemo, useState } from "react";

type BookingCalendarProps = {
  selectedDate: string | null;
  closedDates: Set<string>;
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

function getDayButtonClassName({
  isPast,
  isClosed,
  isSelected,
}: {
  isPast: boolean;
  isClosed: boolean;
  isSelected: boolean;
}): string {
  if (isSelected) {
    return "bg-blood text-bone";
  }

  if (isPast || isClosed) {
    return "cursor-not-allowed text-bone/20";
  }

  return "text-bone/60 hover:bg-blood/20 hover:text-bone";
}

export function BookingCalendar({
  selectedDate,
  closedDates,
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
    onMonthChange(viewedMonth.getFullYear(), viewedMonth.getMonth());
  }, [viewedMonth, onMonthChange]);

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
      const date = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth(), day);
      cells.push({ date, dateStr: toDateString(date) });
    }

    return cells;
  }, [viewedMonth]);

  function handlePrev() {
    if (!canGoPrev) return;
    setViewedMonth((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }

  function handleNext() {
    if (!canGoNext) return;
    setViewedMonth((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }

  return (
    <div className="w-full rounded-md border border-void-mist bg-void-deep p-3 lg:p-4 xl:p-5">
      <div className="mb-3 flex items-center justify-between lg:mb-4">
        <button
          type="button"
          onClick={handlePrev}
          disabled={!canGoPrev}
          aria-label="Mese precedente"
          className="rounded px-2.5 py-1.5 text-sm text-bone/70 transition-colors hover:bg-blood/20 hover:text-bone disabled:cursor-not-allowed disabled:opacity-30"
        >
          ←
        </button>
        <span className="font-heading text-base text-blood-bright lg:text-lg xl:text-xl">
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

      <div className="grid grid-cols-7 gap-0.5 text-center text-[0.65rem] text-bone/50 min-[550px]:gap-1 min-[550px]:text-xs lg:text-sm">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-1">
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 min-[550px]:gap-1">
        {days.map((cell, index) => {
          if (!cell) {
            return <span key={`blank-${index}`} aria-hidden="true" />;
          }

          const isPast = cell.date.getTime() < today.getTime();
          const isClosed = closedDates.has(cell.dateStr);
          const isSelected = cell.dateStr === selectedDate;
          const isDisabled = isPast || isClosed;

          return (
            <button
              key={cell.dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDate(cell.dateStr)}
              onMouseEnter={() => {
                if (!isDisabled) onDayHover?.(cell.dateStr);
              }}
              onFocus={() => {
                if (!isDisabled) onDayHover?.(cell.dateStr);
              }}
              className={`flex aspect-square w-full items-center justify-center rounded text-xs transition-colors min-[550px]:text-xs lg:text-sm xl:text-base ${getDayButtonClassName(
                { isPast, isClosed, isSelected },
              )}`}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

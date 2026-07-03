"use client";

import { useMemo, useState } from "react";

type BookingCalendarProps = {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
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

// Limite solo presentazionale per non far navigare troppo avanti nel
// calendario: la validazione reale della data resta interamente lato server
// (getAvailableSlots/holdSlot).
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

export function BookingCalendar({
  selectedDate,
  onSelectDate,
}: BookingCalendarProps) {
  const today = useMemo(() => startOfToday(), []);
  const minMonth = useMemo(() => startOfMonth(today), [today]);
  const maxMonth = useMemo(() => {
    const max = startOfMonth(today);
    max.setMonth(max.getMonth() + MAX_MONTHS_AHEAD);
    return max;
  }, [today]);

  const [viewedMonth, setViewedMonth] = useState(minMonth);

  const canGoPrev = viewedMonth.getTime() > minMonth.getTime();
  const canGoNext = viewedMonth.getTime() < maxMonth.getTime();

  const days = useMemo<Array<DayCell | null>>(() => {
    const firstDay = startOfMonth(viewedMonth);
    const lastDay = new Date(
      viewedMonth.getFullYear(),
      viewedMonth.getMonth() + 1,
      0,
    );
    // Lunedi = 0 ... Domenica = 6 (getDay() nativo ha Domenica = 0).
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
    <div className="rounded-md border border-void-mist bg-void-deep p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrev}
          disabled={!canGoPrev}
          aria-label="Mese precedente"
          className="rounded px-3 py-1 text-bone/70 transition-colors hover:bg-blood/20 hover:text-bone disabled:cursor-not-allowed disabled:opacity-30"
        >
          ←
        </button>
        <span className="font-[family-name:var(--font-display)] text-lg text-bone">
          {MONTH_LABELS[viewedMonth.getMonth()]} {viewedMonth.getFullYear()}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoNext}
          aria-label="Mese successivo"
          className="rounded px-3 py-1 text-bone/70 transition-colors hover:bg-blood/20 hover:text-bone disabled:cursor-not-allowed disabled:opacity-30"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-bone/50">
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
          const isSelected = cell.dateStr === selectedDate;

          return (
            <button
              key={cell.dateStr}
              type="button"
              disabled={isPast}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`aspect-square rounded text-sm transition-colors ${
                isSelected
                  ? "bg-blood text-bone"
                  : isPast
                    ? "cursor-not-allowed text-bone/20"
                    : "text-bone/80 hover:bg-blood/20 hover:text-bone"
              }`}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

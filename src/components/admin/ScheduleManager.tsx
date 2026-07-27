"use client";

import { useActionState, useEffect, useState } from "react";
import {
  deleteScheduleOverride,
  updateWeeklyOpeningHours,
  upsertScheduleOverride,
} from "@/app/_actions/admin/schedule";
import type { AdminActionResult } from "@/app/_lib/admin/action-result";
import {
  WEEKDAY_LABELS_IT,
  enumerateDateRange,
  type WeeklyDayHours,
} from "@/app/_lib/bookings/weekly-hours-shared";
import {
  AdminFormFeedback,
  adminButtonClassName,
  adminInputClassName,
  adminLabelClassName,
  adminSecondaryButtonClassName,
} from "@/components/admin/AdminFormFeedback";

type RoomOption = { id: string; name: string };

type ScheduleOverrideRow = {
  id: string;
  date: string;
  roomId: string | null;
  roomName: string | null;
  type: "CLOSED" | "CUSTOM_HOURS";
  openHour: number | null;
  closeHour: number | null;
  reason: string | null;
};

type ScheduleManagerProps = {
  rooms: RoomOption[];
  overrides: ScheduleOverrideRow[];
  weeklyHours: WeeklyDayHours[];
};

export function ScheduleManager({
  rooms,
  overrides,
  weeklyHours,
}: ScheduleManagerProps) {
  const [weeklyState, weeklyAction, weeklyPending] = useActionState<
    AdminActionResult | null,
    FormData
  >(updateWeeklyOpeningHours, null);

  const [createState, createAction, createPending] = useActionState<
    AdminActionResult | null,
    FormData
  >(upsertScheduleOverride, null);

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [draftDate, setDraftDate] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [overrideType, setOverrideType] = useState<"CLOSED" | "CUSTOM_HOURS">(
    "CLOSED",
  );

  useEffect(() => {
    if (!createState?.success) return;
    setSelectedDates([]);
    setRangeStart("");
    setRangeEnd("");
  }, [createState]);

  function addSelectedDate(date: string) {
    if (!date) return;
    setSelectedDates((prev) =>
      prev.includes(date) ? prev : [...prev, date].sort(),
    );
  }

  function addRange() {
    if (!rangeStart) return;
    const end = rangeEnd || rangeStart;
    const dates = enumerateDateRange(rangeStart, end);
    if (dates.length === 0) {
      return;
    }
    setSelectedDates((prev) =>
      Array.from(new Set([...prev, ...dates])).sort(),
    );
  }

  function removeDate(date: string) {
    setSelectedDates((prev) => prev.filter((item) => item !== date));
  }

  return (
    <div className="flex flex-col gap-10">
      <form
        action={weeklyAction}
        className="flex flex-col gap-4 rounded border border-void-mist p-4"
      >
        <AdminFormFeedback state={weeklyState} />
        <div>
          <h3 className="text-lg text-bone">Orari settimanali</h3>
          <p className="mt-1 text-sm text-bone/60">
            Giorni di lavoro e orari di apertura/chiusura di default. Gli
            override sotto hanno priorità su queste regole.
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {weeklyHours.map((day) => (
            <li
              key={day.dayOfWeek}
              className="grid gap-3 rounded border border-void-mist/70 p-3 sm:grid-cols-[8rem_auto_1fr_1fr]"
            >
              <span className="self-center text-sm text-bone">
                {WEEKDAY_LABELS_IT[day.dayOfWeek]}
              </span>
              <label className="flex items-center gap-2 self-center text-sm text-bone/80">
                <input
                  type="checkbox"
                  name={`day_${day.dayOfWeek}_isOpen`}
                  value="true"
                  defaultChecked={day.isOpen}
                />
                Aperto
              </label>
              <label className={adminLabelClassName}>
                Apertura
                <input
                  name={`day_${day.dayOfWeek}_openHour`}
                  type="number"
                  min={0}
                  max={23}
                  required
                  defaultValue={day.openHour}
                  className={adminInputClassName}
                />
              </label>
              <label className={adminLabelClassName}>
                Chiusura
                <input
                  name={`day_${day.dayOfWeek}_closeHour`}
                  type="number"
                  min={1}
                  max={24}
                  required
                  defaultValue={day.closeHour}
                  className={adminInputClassName}
                />
              </label>
            </li>
          ))}
        </ul>

        <button type="submit" disabled={weeklyPending} className={adminButtonClassName}>
          {weeklyPending ? "Salvataggio…" : "Salva orari settimanali"}
        </button>
      </form>

      <form
        action={createAction}
        className="flex flex-col gap-4 rounded border border-void-mist p-4"
      >
        <AdminFormFeedback state={createState} />
        <div>
          <h3 className="text-lg text-bone">Nuovo override</h3>
          <p className="mt-1 text-sm text-bone/60">
            Eccezioni su una o più date (chiusura o orario personalizzato).
          </p>
        </div>

        {selectedDates.map((date) => (
          <input key={date} type="hidden" name="dates" value={date} readOnly />
        ))}

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className={adminLabelClassName}>
            Aggiungi giorno
            <input
              type="date"
              value={draftDate}
              onChange={(event) => setDraftDate(event.target.value)}
              className={adminInputClassName}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              addSelectedDate(draftDate);
              setDraftDate("");
            }}
            className={`${adminSecondaryButtonClassName} self-end`}
          >
            Aggiungi
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className={adminLabelClassName}>
            Dal
            <input
              type="date"
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
              className={adminInputClassName}
            />
          </label>
          <label className={adminLabelClassName}>
            Al
            <input
              type="date"
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
              className={adminInputClassName}
            />
          </label>
          <button
            type="button"
            onClick={addRange}
            className={`${adminSecondaryButtonClassName} self-end`}
          >
            Aggiungi periodo
          </button>
        </div>

        <div className="rounded border border-void-mist/70 p-3">
          <p className="mb-2 text-sm text-bone/70">
            Giorni selezionati ({selectedDates.length})
          </p>
          {selectedDates.length === 0 ? (
            <p className="text-sm text-blood-bright">
              Seleziona almeno un giorno o un periodo.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {selectedDates.map((date) => (
                <li key={date}>
                  <button
                    type="button"
                    onClick={() => removeDate(date)}
                    className="rounded border border-void-mist px-2 py-1 text-xs text-bone/80 hover:border-blood/60 hover:text-blood-bright"
                    title="Rimuovi"
                  >
                    {date} ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className={adminLabelClassName}>
          Stanza (vuoto = tutte)
          <select name="roomId" defaultValue="" className={adminInputClassName}>
            <option value="">Tutte le stanze</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>

        <label className={adminLabelClassName}>
          Tipo
          <select
            name="type"
            value={overrideType}
            onChange={(event) =>
              setOverrideType(event.target.value as "CLOSED" | "CUSTOM_HOURS")
            }
            className={adminInputClassName}
          >
            <option value="CLOSED">Chiuso</option>
            <option value="CUSTOM_HOURS">Orario personalizzato</option>
          </select>
        </label>

        {overrideType === "CUSTOM_HOURS" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={adminLabelClassName}>
              Apertura (ora)
              <input
                name="openHour"
                type="number"
                min={0}
                max={23}
                required
                className={adminInputClassName}
              />
            </label>
            <label className={adminLabelClassName}>
              Chiusura (ora)
              <input
                name="closeHour"
                type="number"
                min={1}
                max={24}
                required
                className={adminInputClassName}
              />
            </label>
          </div>
        ) : null}

        <label className={adminLabelClassName}>
          Motivo (opzionale)
          <input name="reason" maxLength={500} className={adminInputClassName} />
        </label>

        <button
          type="submit"
          disabled={createPending || selectedDates.length === 0}
          className={adminButtonClassName}
        >
          {createPending
            ? "Salvataggio…"
            : selectedDates.length > 1
              ? `Crea ${selectedDates.length} override`
              : "Crea override"}
        </button>
      </form>

      <div>
        <h3 className="mb-3 text-lg text-bone">Override esistenti</h3>
        {overrides.length === 0 ? (
          <p className="text-sm text-bone/60">Nessun override configurato.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {overrides.map((override) => (
              <ScheduleOverrideRowItem key={override.id} override={override} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ScheduleOverrideRowItem({
  override,
}: {
  override: ScheduleOverrideRow;
}) {
  const [deleteState, deleteAction, deletePending] = useActionState<
    AdminActionResult | null,
    FormData
  >(deleteScheduleOverride, null);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded border border-void-mist p-4 text-sm text-bone/80">
      <div>
        <p className="text-bone">
          {override.date} — {override.roomName ?? "Tutte le stanze"}
        </p>
        <p>
          {override.type === "CLOSED"
            ? "Chiuso"
            : `Orario ${override.openHour}:00 – ${override.closeHour}:00`}
        </p>
        {override.reason ? <p className="text-bone/60">{override.reason}</p> : null}
      </div>
      <form action={deleteAction}>
        <input type="hidden" name="overrideId" value={override.id} readOnly />
        <AdminFormFeedback state={deleteState} />
        <button type="submit" disabled={deletePending} className={adminSecondaryButtonClassName}>
          {deletePending ? "Eliminazione…" : "Elimina"}
        </button>
      </form>
    </li>
  );
}

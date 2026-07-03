"use client";

import { useActionState } from "react";
import {
  deleteScheduleOverride,
  upsertScheduleOverride,
} from "@/app/_actions/admin/schedule";
import type { AdminActionResult } from "@/app/_lib/admin/action-result";
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
};

export function ScheduleManager({ rooms, overrides }: ScheduleManagerProps) {
  const [createState, createAction, createPending] = useActionState<
    AdminActionResult | null,
    FormData
  >(upsertScheduleOverride, null);

  return (
    <div className="flex flex-col gap-8">
      <form action={createAction} className="flex flex-col gap-4 rounded border border-void-mist p-4">
        <AdminFormFeedback state={createState} />
        <h3 className="text-lg text-bone">Nuovo override</h3>

        <label className={adminLabelClassName}>
          Data
          <input name="date" type="date" required className={adminInputClassName} />
        </label>

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
          <select name="type" defaultValue="CLOSED" className={adminInputClassName}>
            <option value="CLOSED">Chiuso</option>
            <option value="CUSTOM_HOURS">Orario personalizzato</option>
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={adminLabelClassName}>
            Apertura (ora)
            <input name="openHour" type="number" min="0" max="23" className={adminInputClassName} />
          </label>
          <label className={adminLabelClassName}>
            Chiusura (ora)
            <input name="closeHour" type="number" min="1" max="24" className={adminInputClassName} />
          </label>
        </div>

        <label className={adminLabelClassName}>
          Motivo (opzionale)
          <input name="reason" maxLength={500} className={adminInputClassName} />
        </label>

        <button type="submit" disabled={createPending} className={adminButtonClassName}>
          {createPending ? "Salvataggio…" : "Crea override"}
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

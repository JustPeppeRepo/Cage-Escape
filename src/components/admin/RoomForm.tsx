"use client";

import { useActionState } from "react";
import { upsertRoom } from "@/app/_actions/admin/rooms";
import type { AdminActionResult } from "@/app/_lib/admin/action-result";
import {
  AdminFormFeedback,
  adminButtonClassName,
  adminInputClassName,
  adminLabelClassName,
} from "@/components/admin/AdminFormFeedback";
import { MediaUploadField } from "@/components/admin/MediaUploadField";

type RoomFormProps = {
  room?: {
    id: string;
    slug: string;
    name: string;
    description: string;
    prezzoTotale: string;
    prezzoCaparra: string;
    durationMinutes: number;
    minPlayers: number;
    maxPlayers: number;
    terrorLevel: number;
    isActive: boolean;
    imageUrl: string | null;
  };
};

export function RoomForm({ room }: RoomFormProps) {
  const [state, formAction, pending] = useActionState<
    AdminActionResult | null,
    FormData
  >(upsertRoom, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {room ? <input type="hidden" name="id" value={room.id} readOnly /> : null}
      <AdminFormFeedback state={state} />

      {room ? (
        <MediaUploadField
          uploadUrl={`/api/admin/media/rooms/${room.id}`}
          currentImageUrl={room.imageUrl}
          label="Foto stanza"
        />
      ) : (
        <p className="rounded border border-void-mist px-3 py-2 text-sm text-bone/60">
          Dopo aver creato la stanza potrai caricare la foto di copertina.
        </p>
      )}

      <label className={adminLabelClassName}>
        Slug
        <input
          name="slug"
          required
          defaultValue={room?.slug}
          className={adminInputClassName}
        />
      </label>

      <label className={adminLabelClassName}>
        Nome
        <input
          name="name"
          required
          defaultValue={room?.name}
          className={adminInputClassName}
        />
      </label>

      <label className={adminLabelClassName}>
        Descrizione
        <textarea
          name="description"
          required
          rows={4}
          defaultValue={room?.description}
          className={adminInputClassName}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={adminLabelClassName}>
          Prezzo indicativo totale (€)
          <input
            name="prezzoTotale"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={room?.prezzoTotale}
            className={adminInputClassName}
          />
        </label>
        <label className={adminLabelClassName}>
          Prezzo indicativo caparra (€)
          <input
            name="prezzoCaparra"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={room?.prezzoCaparra}
            className={adminInputClassName}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className={adminLabelClassName}>
          Durata (min)
          <input
            name="durationMinutes"
            type="number"
            min="30"
            required
            defaultValue={room?.durationMinutes ?? 90}
            className={adminInputClassName}
          />
        </label>
        <label className={adminLabelClassName}>
          Min giocatori
          <input
            name="minPlayers"
            type="number"
            min="1"
            required
            defaultValue={room?.minPlayers ?? 2}
            className={adminInputClassName}
          />
        </label>
        <label className={adminLabelClassName}>
          Max giocatori
          <input
            name="maxPlayers"
            type="number"
            min="1"
            required
            defaultValue={room?.maxPlayers ?? 6}
            className={adminInputClassName}
          />
        </label>
      </div>

      <label className={adminLabelClassName}>
        Livello terrore (1-5)
        <input
          name="terrorLevel"
          type="number"
          min="1"
          max="5"
          required
          defaultValue={room?.terrorLevel ?? 3}
          className={adminInputClassName}
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-bone/80">
        <input
          type="checkbox"
          name="isActive"
          value="true"
          defaultChecked={room?.isActive ?? true}
        />
        Stanza attiva (visibile sul sito)
      </label>

      <button type="submit" disabled={pending} className={adminButtonClassName}>
        {pending ? "Salvataggio…" : room ? "Aggiorna stanza" : "Crea stanza"}
      </button>
    </form>
  );
}

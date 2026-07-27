"use client";

import { useActionState } from "react";
import { updateSiteSettings } from "@/app/_actions/admin/settings";
import type { AdminActionResult } from "@/app/_lib/admin/action-result";
import {
  AdminFormFeedback,
  adminButtonClassName,
  adminInputClassName,
  adminLabelClassName,
} from "@/components/admin/AdminFormFeedback";

type SiteSettingsFormProps = {
  easterEggDiscountEnabled: boolean;
  easterEggDiscountPercent: number;
  slotCooldownMinutes: number;
};

export function SiteSettingsForm({
  easterEggDiscountEnabled,
  easterEggDiscountPercent,
  slotCooldownMinutes,
}: SiteSettingsFormProps) {
  const [state, formAction, pending] = useActionState<
    AdminActionResult | null,
    FormData
  >(updateSiteSettings, null);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-6">
      <AdminFormFeedback state={state} />

      <fieldset className="flex flex-col gap-4">
        <legend className="text-base text-bone">Prenotazioni</legend>

        <label className={adminLabelClassName}>
          Cooldown tra sessioni (minuti)
          <input
            name="slotCooldownMinutes"
            type="number"
            min={0}
            max={120}
            required
            defaultValue={slotCooldownMinutes}
            className={adminInputClassName}
          />
        </label>
        <p className="text-sm text-bone/50">
          Tempo di buffer dopo la fine di una partita prima che la stessa stanza
          possa ospitare la sessione successiva (es. reset sala). 0 = slot
          consecutivi senza pausa.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-base text-bone">Easter egg</legend>

        <label className="flex items-center gap-2 text-sm text-bone/80">
          <input
            type="checkbox"
            name="easterEggDiscountEnabled"
            value="true"
            defaultChecked={easterEggDiscountEnabled}
          />
          Sconto easter egg attivo (&quot;Il Rito della Maledizione&quot;)
        </label>

        <label className={adminLabelClassName}>
          Percentuale sconto (1–50%)
          <input
            name="easterEggDiscountPercent"
            type="number"
            min={1}
            max={50}
            required
            defaultValue={easterEggDiscountPercent}
            className={adminInputClassName}
          />
        </label>

        <p className="text-sm text-bone/50">
          Quando disattivato, il mini-gioco resta accessibile ma non genera codici
          sconto.
        </p>
      </fieldset>

      <button type="submit" disabled={pending} className={adminButtonClassName}>
        {pending ? "Salvataggio…" : "Salva impostazioni"}
      </button>
    </form>
  );
}

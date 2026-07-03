"use client";

import { useActionState } from "react";
import {
  deletePricingTier,
  upsertPricingTier,
} from "@/app/_actions/admin/rooms";
import type { AdminActionResult } from "@/app/_lib/admin/action-result";
import {
  AdminFormFeedback,
  adminButtonClassName,
  adminInputClassName,
  adminLabelClassName,
  adminSecondaryButtonClassName,
} from "@/components/admin/AdminFormFeedback";

type PricingTierRow = {
  id: string;
  minParticipants: number;
  maxParticipants: number;
  totalPrice: string;
  depositPrice: string;
};

type PricingTierManagerProps = {
  roomId: string;
  tiers: PricingTierRow[];
};

export function PricingTierManager({ roomId, tiers }: PricingTierManagerProps) {
  const [createState, createAction, createPending] = useActionState<
    AdminActionResult | null,
    FormData
  >(upsertPricingTier, null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 text-lg text-bone">Fasce di prezzo</h3>
        {tiers.length === 0 ? (
          <p className="text-sm text-bone/60">Nessuna fascia configurata.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tiers.map((tier) => (
              <PricingTierEditRow key={tier.id} roomId={roomId} tier={tier} />
            ))}
          </ul>
        )}
      </div>

      <form action={createAction} className="flex flex-col gap-3 rounded border border-void-mist p-4">
        <input type="hidden" name="roomId" value={roomId} readOnly />
        <AdminFormFeedback state={createState} />
        <p className="text-sm text-bone/70">Aggiungi fascia</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={adminLabelClassName}>
            Min partecipanti
            <input name="minParticipants" type="number" min="1" required className={adminInputClassName} />
          </label>
          <label className={adminLabelClassName}>
            Max partecipanti
            <input name="maxParticipants" type="number" min="1" required className={adminInputClassName} />
          </label>
          <label className={adminLabelClassName}>
            Prezzo totale (€)
            <input name="totalPrice" type="number" step="0.01" min="0" required className={adminInputClassName} />
          </label>
          <label className={adminLabelClassName}>
            Caparra (€)
            <input name="depositPrice" type="number" step="0.01" min="0" required className={adminInputClassName} />
          </label>
        </div>
        <button type="submit" disabled={createPending} className={adminButtonClassName}>
          {createPending ? "Salvataggio…" : "Aggiungi fascia"}
        </button>
      </form>
    </div>
  );
}

function PricingTierEditRow({
  roomId,
  tier,
}: {
  roomId: string;
  tier: PricingTierRow;
}) {
  const [updateState, updateAction, updatePending] = useActionState<
    AdminActionResult | null,
    FormData
  >(upsertPricingTier, null);
  const [deleteState, deleteAction, deletePending] = useActionState<
    AdminActionResult | null,
    FormData
  >(deletePricingTier, null);

  return (
    <li className="rounded border border-void-mist p-4">
      <form action={updateAction} className="flex flex-col gap-3">
        <input type="hidden" name="roomId" value={roomId} readOnly />
        <input type="hidden" name="tierId" value={tier.id} readOnly />
        <AdminFormFeedback state={updateState} />
        <div className="grid gap-3 sm:grid-cols-4">
          <label className={adminLabelClassName}>
            Min
            <input
              name="minParticipants"
              type="number"
              defaultValue={tier.minParticipants}
              required
              className={adminInputClassName}
            />
          </label>
          <label className={adminLabelClassName}>
            Max
            <input
              name="maxParticipants"
              type="number"
              defaultValue={tier.maxParticipants}
              required
              className={adminInputClassName}
            />
          </label>
          <label className={adminLabelClassName}>
            Totale €
            <input
              name="totalPrice"
              type="number"
              step="0.01"
              defaultValue={tier.totalPrice}
              required
              className={adminInputClassName}
            />
          </label>
          <label className={adminLabelClassName}>
            Caparra €
            <input
              name="depositPrice"
              type="number"
              step="0.01"
              defaultValue={tier.depositPrice}
              required
              className={adminInputClassName}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={updatePending} className={adminSecondaryButtonClassName}>
            {updatePending ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </form>
      <form action={deleteAction} className="mt-2">
        <input type="hidden" name="tierId" value={tier.id} readOnly />
        <input type="hidden" name="roomId" value={roomId} readOnly />
        <AdminFormFeedback state={deleteState} />
        <button
          type="submit"
          disabled={deletePending}
          className="text-sm text-blood-bright hover:underline"
        >
          {deletePending ? "Eliminazione…" : "Elimina fascia"}
        </button>
      </form>
    </li>
  );
}

"use client";

import { useActionState } from "react";
import { cancelMyBooking } from "@/app/_actions/bookings";

type CancelMyBookingButtonProps = {
  bookingId: string;
  variant: "free" | "refund";
};

export function CancelMyBookingButton({
  bookingId,
  variant,
}: CancelMyBookingButtonProps) {
  const [state, formAction, pending] = useActionState(cancelMyBooking, null);

  const label = variant === "refund" ? "Annulla e richiedi rimborso" : "Annulla";
  const pendingLabel = variant === "refund" ? "Rimborso…" : "Annullamento…";

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="bookingId" value={bookingId} readOnly />
      {state ? (
        state.success ? (
          <p className="text-xs text-ectoplasm">
            {state.data.refunded
              ? "Annullata: rimborso avviato."
              : "Prenotazione annullata."}
          </p>
        ) : (
          <p className="text-xs text-blood-bright">{state.error}</p>
        )
      ) : null}
      <button
        type="submit"
        disabled={pending || state?.success}
        className="rounded border border-void-mist px-3 py-1.5 text-xs text-bone/80 transition-colors hover:border-blood/60 hover:text-blood-bright disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}

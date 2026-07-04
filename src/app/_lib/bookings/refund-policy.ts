import { BookingStatus } from "@/generated/prisma/client";
import { REFUND_CUTOFF_HOURS } from "@/app/_lib/bookings/constants";

const REFUND_CUTOFF_MS = REFUND_CUTOFF_HOURS * 60 * 60 * 1000;

export type CancellationEligibility =
  | { kind: "FREE_CANCEL" }
  | { kind: "REFUND_ELIGIBLE"; refundCutoffAt: Date }
  | { kind: "PAST_CUTOFF" }
  | { kind: "MANUAL_REVIEW" }
  | { kind: "NOT_CANCELLABLE" };

type CancellableBooking = {
  status: BookingStatus;
  startTime: Date;
};

// Unica fonte di verita' per l'idoneita' all'annullamento/rimborso: usata sia
// lato UI (per mostrare/nascondere il pulsante e la scadenza) sia dentro il
// server action (unico punto che conta davvero, mai fidarsi del client).
export function getCancellationEligibility(
  booking: CancellableBooking,
  now: Date = new Date(),
): CancellationEligibility {
  if (
    booking.status === BookingStatus.CANCELLED ||
    booking.status === BookingStatus.COMPLETED
  ) {
    return { kind: "NOT_CANCELLABLE" };
  }

  if (booking.status === BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED) {
    return { kind: "MANUAL_REVIEW" };
  }

  if (booking.status === BookingStatus.PENDING) {
    return { kind: "FREE_CANCEL" };
  }

  // PAID o DEPOSIT_PAID: annullamento consentito con rimborso solo se mancano
  // piu' di REFUND_CUTOFF_HOURS all'inizio dell'evento. Se l'evento e' gia'
  // iniziato/passato la stessa condizione blocca comunque l'annullamento,
  // dato che startTime - cutoff < now in quel caso.
  const refundCutoffAt = new Date(booking.startTime.getTime() - REFUND_CUTOFF_MS);

  if (now.getTime() >= refundCutoffAt.getTime()) {
    return { kind: "PAST_CUTOFF" };
  }

  return { kind: "REFUND_ELIGIBLE", refundCutoffAt };
}

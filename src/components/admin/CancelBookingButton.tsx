"use client";

import { useActionState } from "react";
import { cancelBooking } from "@/app/_actions/admin/bookings";
import type { AdminActionResult } from "@/app/_lib/admin/action-result";
import {
  AdminFormFeedback,
  adminSecondaryButtonClassName,
} from "@/components/admin/AdminFormFeedback";

type CancelBookingButtonProps = {
  bookingId: string;
};

export function CancelBookingButton({ bookingId }: CancelBookingButtonProps) {
  const [state, formAction, pending] = useActionState<
    AdminActionResult | null,
    FormData
  >(cancelBooking, null);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="bookingId" value={bookingId} readOnly />
      <AdminFormFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className={adminSecondaryButtonClassName}
      >
        {pending ? "Annullamento…" : "Annulla"}
      </button>
    </form>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { BookingStatus, PaymentStatus } from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { stripe } from "@/app/_lib/stripe";
import { cancelBookingSchema } from "@/app/_lib/admin/schemas";
import {
  type AdminActionResult,
  formDataToObject,
} from "@/app/_lib/admin/action-result";

const REFUNDABLE_STATUSES: BookingStatus[] = [
  BookingStatus.PAID,
  BookingStatus.DEPOSIT_PAID,
  // Booking con pagamento incassato da Stripe ma bloccato per un conflitto
  // (slot, importo, metadata, codice sconto...): il webhook registra sempre
  // una riga Payment SUCCEEDED anche per questi casi, quindi vanno rimborsati
  // esattamente come PAID/DEPOSIT_PAID invece di essere annullati "a secco".
  BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
];

export async function cancelBooking(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = cancelBookingSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
    };
  }

  const { bookingId } = parsed.data;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: {
          where: { status: PaymentStatus.SUCCEEDED },
        },
      },
    });

    if (!booking) {
      return { success: false, error: "Prenotazione non trovata" };
    }

    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED
    ) {
      return {
        success: false,
        error: "Questa prenotazione non può essere annullata",
      };
    }

    if (REFUNDABLE_STATUSES.includes(booking.status)) {
      if (booking.payments.length === 0) {
        return {
          success: false,
          error: "Nessun pagamento registrato da rimborsare",
        };
      }

      for (const payment of booking.payments) {
        try {
          await stripe.refunds.create({
            payment_intent: payment.stripePaymentId,
          });
        } catch (error) {
          console.error("[admin/cancelBooking] Stripe refund failed", {
            bookingId,
            paymentId: payment.id,
            error,
          });
          return {
            success: false,
            error: "Rimborso Stripe non riuscito; prenotazione non annullata",
          };
        }
      }

      await prisma.payment.updateMany({
        where: {
          bookingId: booking.id,
          status: PaymentStatus.SUCCEEDED,
        },
        data: { status: PaymentStatus.REFUNDED },
      });
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        holdExpiresAt: null,
      },
    });

    revalidatePath("/admin/bookings");
    revalidatePath("/admin");

    return { success: true, message: "Prenotazione annullata" };
  } catch (error) {
    console.error("[admin/cancelBooking]", error);
    return { success: false, error: "Errore durante l'annullamento" };
  }
}

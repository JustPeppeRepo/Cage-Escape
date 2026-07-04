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
import { logError } from "@/lib/logger";
import { sendStripeOpsAlert } from "@/app/_lib/stripe/ops-alert";

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

    const originalStatus = booking.status;
    const needsRefund = REFUNDABLE_STATUSES.includes(originalStatus);

    if (needsRefund) {
      if (booking.payments.length === 0) {
        return {
          success: false,
          error: "Nessun pagamento registrato da rimborsare",
        };
      }

      // Rimborso per-pagamento: ogni pagamento viene rimborsato e marcato
      // REFUNDED individualmente subito dopo il successo della singola
      // chiamata Stripe (idempotencyKey previene doppi rimborsi su
      // doppio-click o retry di rete), cosi' un fallimento su un pagamento
      // successivo non lascia un rimborso gia' incassato senza traccia nel
      // nostro sistema.
      const refundedPaymentIds: string[] = [];
      const failedPayments: Array<{ paymentId: string; error: string }> = [];

      for (const payment of booking.payments) {
        try {
          await stripe.refunds.create(
            { payment_intent: payment.stripePaymentId },
            { idempotencyKey: `admin-refund-${payment.id}` },
          );
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.REFUNDED },
          });
          refundedPaymentIds.push(payment.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError("admin/cancelBooking", "Rimborso Stripe fallito per un pagamento", {
            bookingId,
            paymentId: payment.id,
            error: message,
          });
          failedPayments.push({ paymentId: payment.id, error: message });
        }
      }

      if (failedPayments.length > 0) {
        if (refundedPaymentIds.length === 0) {
          // Nessun rimborso e' andato a buon fine: nessun denaro si e'
          // mosso, la prenotazione resta nello stato originale.
          await sendStripeOpsAlert({
            subject: "Rimborso admin fallito",
            details: { bookingId, originalStatus, failedPayments },
          });
          return {
            success: false,
            error: "Rimborso Stripe non riuscito; prenotazione non annullata",
          };
        }

        // Rimborso parziale: almeno un pagamento e' stato restituito da
        // Stripe, almeno un altro no. Non possiamo annullare la
        // prenotazione come se tutto fosse andato bene: serve intervento
        // manuale per riconciliare i pagamenti falliti.
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED },
        });
        logError(
          "admin/cancelBooking",
          "Rimborso parziale: intervento manuale richiesto",
          { bookingId, refundedPaymentIds, failedPayments },
        );
        await sendStripeOpsAlert({
          subject: "Rimborso admin parziale - intervento manuale richiesto",
          details: { bookingId, refundedPaymentIds, failedPayments },
        });
        return {
          success: false,
          error:
            "Rimborso parzialmente completato: alcuni pagamenti non sono stati rimborsati. Verifica manualmente prima di riprovare.",
        };
      }
    }

    const claimed = await prisma.booking.updateMany({
      where: { id: bookingId, status: originalStatus },
      data: {
        status: BookingStatus.CANCELLED,
        holdExpiresAt: null,
      },
    });

    if (claimed.count !== 1 && !needsRefund) {
      return {
        success: false,
        error: "Questa prenotazione è già stata aggiornata altrove",
      };
    }

    revalidatePath("/admin/bookings");
    revalidatePath("/admin");

    return { success: true, message: "Prenotazione annullata" };
  } catch (error) {
    logError("admin/cancelBooking", "Unexpected error", {
      bookingId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Errore durante l'annullamento" };
  }
}

"use server";

import { Prisma } from "@/generated/prisma/client";
import { BookingStatus } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/app/_lib/prisma";
import { stripe } from "@/app/_lib/stripe";
import { env } from "@/app/_lib/env";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import { HOLD_DURATION_MS } from "@/app/_lib/bookings/constants";
import {
  createStripeCheckoutSessionSchema,
  getAvailableSlotsSchema,
  holdSlotSchema,
} from "@/app/_lib/bookings/schemas";
import {
  decimalToStripeCents,
  formatEuroAmount,
} from "@/app/_lib/bookings/money";
import {
  getAvailableSlotsForRoom,
  isSlotAvailable,
  releaseExpiredHolds,
} from "@/app/_lib/bookings/slots";

export type BookingActionError = {
  success: false;
  error: string;
  code: string;
};

export type BookingActionSuccess<T> = {
  success: true;
  data: T;
};

export type BookingActionResult<T> =
  | BookingActionSuccess<T>
  | BookingActionError;

type AvailableSlotPayload = {
  slots: Array<{ startTime: string; endTime: string }>;
};

type HoldSlotPayload = {
  bookingId: string;
  holdExpiresAt: string;
  totalAmount: string;
  depositAmount: string;
};

type CheckoutSessionPayload = {
  url: string;
};

function formDataToObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

function isPrismaKnownError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export async function getAvailableSlots(
  prevState: unknown,
  formData: FormData,
): Promise<BookingActionResult<AvailableSlotPayload>> {
  const rateLimit = await checkRateLimit("getAvailableSlots", 30);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Troppe richieste. Riprova tra ${rateLimit.retryAfterSeconds} secondi.`,
      code: "RATE_LIMITED",
    };
  }

  const parsed = getAvailableSlotsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
      code: "VALIDATION_ERROR",
    };
  }

  const { roomSlug, date } = parsed.data;

  try {
    const room = await prisma.room.findFirst({
      where: { slug: roomSlug, isActive: true },
      select: { id: true, durationMinutes: true },
    });

    if (!room) {
      return {
        success: false,
        error: "Stanza non trovata o non disponibile",
        code: "ROOM_NOT_FOUND",
      };
    }

    const slots = await getAvailableSlotsForRoom(room.id, room.durationMinutes, date);

    return {
      success: true,
      data: {
        slots: slots.map((slot) => ({
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
        })),
      },
    };
  } catch (error) {
    console.error("[getAvailableSlots]", error);
    return {
      success: false,
      error: "Errore durante il recupero degli slot disponibili",
      code: "INTERNAL_ERROR",
    };
  }
}

export async function holdSlot(
  prevState: unknown,
  formData: FormData,
): Promise<BookingActionResult<HoldSlotPayload>> {
  const rateLimit = await checkRateLimit("holdSlot", 10);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Troppe richieste. Riprova tra ${rateLimit.retryAfterSeconds} secondi.`,
      code: "RATE_LIMITED",
    };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Devi effettuare l'accesso per prenotare",
      code: "UNAUTHORIZED",
    };
  }

  const parsed = holdSlotSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
      code: "VALIDATION_ERROR",
    };
  }

  const { roomSlug, startTime, participantCount, minorCount, paymentChoice } =
    parsed.data;
  const slotStart = new Date(startTime);

  if (Number.isNaN(slotStart.getTime())) {
    return {
      success: false,
      error: "Orario non valido",
      code: "VALIDATION_ERROR",
    };
  }

  if (slotStart <= new Date()) {
    return {
      success: false,
      error: "Non puoi prenotare uno slot nel passato",
      code: "VALIDATION_ERROR",
    };
  }

  try {
    const room = await prisma.room.findFirst({
      where: { slug: roomSlug, isActive: true },
    });

    if (!room) {
      return {
        success: false,
        error: "Stanza non trovata o non disponibile",
        code: "ROOM_NOT_FOUND",
      };
    }

    if (participantCount < room.minPlayers || participantCount > room.maxPlayers) {
      return {
        success: false,
        error: `Numero partecipanti non valido (${room.minPlayers}-${room.maxPlayers})`,
        code: "VALIDATION_ERROR",
      };
    }

    const slotEnd = new Date(
      slotStart.getTime() + room.durationMinutes * 60_000,
    );
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);

    const booking = await prisma.$transaction(
      async (tx) => {
        await releaseExpiredHolds(tx);

        const available = await isSlotAvailable(
          room.id,
          slotStart,
          slotEnd,
          tx,
        );

        if (!available) {
          throw new Error("SLOT_TAKEN");
        }

        return tx.booking.create({
          data: {
            userId: session.user.id,
            roomId: room.id,
            startTime: slotStart,
            endTime: slotEnd,
            totalAmount: room.prezzoTotale,
            status: BookingStatus.PENDING,
            holdExpiresAt,
            paymentChoice,
            participantCount,
            minorCount,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      success: true,
      data: {
        bookingId: booking.id,
        holdExpiresAt: booking.holdExpiresAt!.toISOString(),
        totalAmount: formatEuroAmount(room.prezzoTotale),
        depositAmount: formatEuroAmount(room.prezzoCaparra),
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_TAKEN") {
      return {
        success: false,
        error: "Questo slot non è più disponibile",
        code: "SLOT_TAKEN",
      };
    }

    if (isPrismaKnownError(error) && error.code === "P2034") {
      return {
        success: false,
        error: "Questo slot non è più disponibile",
        code: "SLOT_TAKEN",
      };
    }

    if (isPrismaKnownError(error) && error.code === "P2002") {
      return {
        success: false,
        error: "Questo slot non è più disponibile",
        code: "SLOT_TAKEN",
      };
    }

    console.error("[holdSlot]", error);
    return {
      success: false,
      error: "Errore durante il blocco dello slot",
      code: "INTERNAL_ERROR",
    };
  }
}

export async function createStripeCheckoutSession(
  prevState: unknown,
  formData: FormData,
): Promise<BookingActionResult<CheckoutSessionPayload>> {
  const rateLimit = await checkRateLimit("createStripeCheckoutSession", 10);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Troppe richieste. Riprova tra ${rateLimit.retryAfterSeconds} secondi.`,
      code: "RATE_LIMITED",
    };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Devi effettuare l'accesso per completare il pagamento",
      code: "UNAUTHORIZED",
    };
  }

  const parsed = createStripeCheckoutSessionSchema.safeParse(
    formDataToObject(formData),
  );
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
      code: "VALIDATION_ERROR",
    };
  }

  const { bookingId } = parsed.data;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { room: true },
    });

    if (!booking || booking.userId !== session.user.id) {
      return {
        success: false,
        error: "Prenotazione non trovata",
        code: "BOOKING_NOT_FOUND",
      };
    }

    if (booking.status !== BookingStatus.PENDING) {
      return {
        success: false,
        error: "Questa prenotazione non è più valida",
        code: "BOOKING_INVALID",
      };
    }

    if (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date()) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          holdExpiresAt: null,
        },
      });

      return {
        success: false,
        error: "Il tempo per completare la prenotazione è scaduto",
        code: "HOLD_EXPIRED",
      };
    }

    const chargeAmount =
      booking.paymentChoice === "FULL"
        ? booking.room.prezzoTotale
        : booking.room.prezzoCaparra;

    const unitAmount = decimalToStripeCents(chargeAmount);

    if (unitAmount <= 0) {
      return {
        success: false,
        error: "Importo di pagamento non valido",
        code: "INVALID_AMOUNT",
      };
    }

    const expiresAt = Math.floor(booking.holdExpiresAt.getTime() / 1000);

    let checkoutSession;
    try {
      checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: unitAmount,
              product_data: {
                name: booking.room.name,
                description:
                  booking.paymentChoice === "FULL"
                    ? "Pagamento totale prenotazione"
                    : "Caparra prenotazione",
              },
            },
          },
        ],
        metadata: {
          bookingId: booking.id,
          userId: session.user.id,
          paymentChoice: booking.paymentChoice,
        },
        success_url: `${env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.NEXT_PUBLIC_APP_URL}/checkout?bookingId=${booking.id}`,
        expires_at: expiresAt,
        client_reference_id: booking.id,
      });
    } catch (stripeError) {
      console.error("[createStripeCheckoutSession] Stripe error:", stripeError);

      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          holdExpiresAt: null,
        },
      });

      return {
        success: false,
        error: "Impossibile avviare il pagamento. Riprova.",
        code: "STRIPE_ERROR",
      };
    }

    if (!checkoutSession.url) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          holdExpiresAt: null,
        },
      });

      return {
        success: false,
        error: "Impossibile avviare il pagamento. Riprova.",
        code: "STRIPE_ERROR",
      };
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeSessionId: checkoutSession.id },
    });

    return {
      success: true,
      data: { url: checkoutSession.url },
    };
  } catch (error) {
    console.error("[createStripeCheckoutSession]", error);
    return {
      success: false,
      error: "Errore durante la creazione della sessione di pagamento",
      code: "INTERNAL_ERROR",
    };
  }
}

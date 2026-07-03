"use server";

import { Prisma } from "@/generated/prisma/client";
import { BookingStatus } from "@/generated/prisma/client";
import { getCurrentSession } from "@/lib/dal";
import { prisma } from "@/app/_lib/prisma";
import { stripe } from "@/app/_lib/stripe";
import { env } from "@/app/_lib/env";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import {
  HOLD_DURATION_MS,
  MAX_CONCURRENT_HOLDS_PER_USER,
} from "@/app/_lib/bookings/constants";
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
  generateTimeSlots,
  getAvailableSlotsForRoom,
  getRomeDateString,
  isSlotAvailable,
  releaseExpiredHolds,
  resolveDaySchedule,
} from "@/app/_lib/bookings/slots";
import { resolvePricingTier } from "@/app/_lib/bookings/pricing";

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

  const session = await getCurrentSession();
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
      include: { pricingTiers: true },
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

    const tier = resolvePricingTier(room.pricingTiers, participantCount);

    if (!tier) {
      return {
        success: false,
        error: "Nessuna fascia di prezzo disponibile per questo numero di partecipanti",
        code: "VALIDATION_ERROR",
      };
    }

    const dateStr = getRomeDateString(slotStart);
    const schedule = await resolveDaySchedule(dateStr, room.id);

    if (schedule.closed) {
      return {
        success: false,
        error: "La stanza non è disponibile in questa data",
        code: "VALIDATION_ERROR",
      };
    }

    const validSlots = generateTimeSlots(
      dateStr,
      room.durationMinutes,
      schedule.openHour,
      schedule.closeHour,
    );

    const matchedSlot = validSlots.find(
      (slot) => slot.startTime.getTime() === slotStart.getTime(),
    );

    if (!matchedSlot) {
      return {
        success: false,
        error: "Orario non disponibile per questa stanza",
        code: "VALIDATION_ERROR",
      };
    }

    const slotEnd = matchedSlot.endTime;
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);

    const booking = await prisma.$transaction(
      async (tx) => {
        await releaseExpiredHolds(tx);

        const activeHoldsCount = await tx.booking.count({
          where: {
            userId: session.user.id,
            status: BookingStatus.PENDING,
            holdExpiresAt: { gt: new Date() },
          },
        });

        if (activeHoldsCount >= MAX_CONCURRENT_HOLDS_PER_USER) {
          throw new Error("TOO_MANY_HOLDS");
        }

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
            totalAmount: tier.totalPrice,
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
        totalAmount: formatEuroAmount(tier.totalPrice),
        depositAmount: formatEuroAmount(tier.depositPrice),
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

    if (error instanceof Error && error.message === "TOO_MANY_HOLDS") {
      return {
        success: false,
        error: "Hai già delle prenotazioni in attesa di pagamento. Completa o attendi la scadenza di quelle esistenti prima di crearne altre.",
        code: "TOO_MANY_HOLDS",
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

  const session = await getCurrentSession();
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
      include: { room: { include: { pricingTiers: true } } },
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

    const tier = resolvePricingTier(
      booking.room.pricingTiers,
      booking.participantCount,
    );

    if (!tier) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          holdExpiresAt: null,
        },
      });

      return {
        success: false,
        error: "Nessuna fascia di prezzo disponibile per questa prenotazione",
        code: "INTERNAL_ERROR",
      };
    }

    const chargeAmount =
      booking.paymentChoice === "FULL" ? tier.totalPrice : tier.depositPrice;

    const unitAmount = decimalToStripeCents(chargeAmount);

    if (unitAmount <= 0) {
      return {
        success: false,
        error: "Importo di pagamento non valido",
        code: "INVALID_AMOUNT",
      };
    }

    // Stripe rifiuta qualsiasi expires_at inferiore a 30 minuti da adesso:
    // per questo la scadenza tecnica della sessione Stripe e VOLUTAMENTE
    // disaccoppiata dall'hold interno di 10 minuti (booking.holdExpiresAt),
    // che resta l'unica fonte di verita per la regola di business "tempo per
    // pagare". Il webhook gestisce esplicitamente il caso in cui il pagamento
    // arrivi dopo la scadenza dell'hold interno (vedi handleCheckoutCompleted).
    const STRIPE_MIN_EXPIRATION_SECONDS = 30 * 60;
    const expiresAt = Math.floor(Date.now() / 1000) + STRIPE_MIN_EXPIRATION_SECONDS;

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
          roomId: booking.roomId,
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

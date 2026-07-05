"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { BookingStatus, PaymentStatus } from "@/generated/prisma/client";
import { getCurrentSession } from "@/lib/dal";
import { prisma } from "@/app/_lib/prisma";
import {
  getStripeConfigurationError,
  isStripeConfigurationError,
  stripe,
} from "@/app/_lib/stripe";
import { logError } from "@/lib/logger";
import { env } from "@/app/_lib/env";
import { checkRateLimit } from "@/app/_lib/rate-limit";
import {
  HOLD_DURATION_MS,
  MAX_CONCURRENT_HOLDS_PER_USER,
} from "@/app/_lib/bookings/constants";
import {
  cancelMyBookingSchema,
  createStripeCheckoutSessionSchema,
  getAvailableSlotsSchema,
  getMonthAvailabilitySchema,
  getMonthClosedDatesSchema,
  holdSlotSchema,
} from "@/app/_lib/bookings/schemas";
import { getCancellationEligibility } from "@/app/_lib/bookings/refund-policy";
import { sendStripeOpsAlert } from "@/app/_lib/stripe/ops-alert";
import {
  decimalToStripeCents,
  formatEuroAmount,
} from "@/app/_lib/bookings/money";
import {
  generateTimeSlots,
  getAvailableSlotsForRoom,
  getRomeDateString,
  getRoomMonthAvailability,
  getMonthClosedDates as getMonthClosedDatesForRoom,
  isSlotAvailable,
  releaseExpiredHolds,
  resolveDaySchedule,
} from "@/app/_lib/bookings/slots";
import { resolvePricingTier } from "@/app/_lib/bookings/pricing";
import { getBookingChargeAmount } from "@/app/_lib/bookings/charge-amount";
import { validateDiscountCodeForUser } from "@/app/_lib/bookings/discount-code";
import { applyDiscountPercent } from "@/app/_lib/admin/discount";

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
  date: string;
  slots: Array<{ startTime: string; endTime: string }>;
};

type MonthClosedDatesPayload = {
  closedDates: string[];
};

type MonthAvailabilityPayload = {
  days: Record<string, "available" | "partial" | "unavailable">;
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

  const { roomSlug, roomId: providedRoomId, date } = parsed.data;

  try {
    let roomId = providedRoomId;
    let durationMinutes: number;

    if (roomId) {
      const room = await prisma.room.findFirst({
        where: { id: roomId, slug: roomSlug, isActive: true },
        select: { id: true, durationMinutes: true },
      });

      if (!room) {
        return {
          success: false,
          error: "Stanza non trovata o non disponibile",
          code: "ROOM_NOT_FOUND",
        };
      }

      durationMinutes = room.durationMinutes;
    } else {
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

      roomId = room.id;
      durationMinutes = room.durationMinutes;
    }

    const slots = await getAvailableSlotsForRoom(roomId, durationMinutes, date);

    return {
      success: true,
      data: {
        date,
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

export async function getMonthClosedDates(
  prevState: unknown,
  formData: FormData,
): Promise<BookingActionResult<MonthClosedDatesPayload>> {
  const parsed = getMonthClosedDatesSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
      code: "VALIDATION_ERROR",
    };
  }

  const { roomSlug, roomId: providedRoomId, year, month } = parsed.data;

  try {
    let roomId = providedRoomId;

    if (roomId) {
      const room = await prisma.room.findFirst({
        where: { id: roomId, slug: roomSlug, isActive: true },
        select: { id: true },
      });

      if (!room) {
        return {
          success: false,
          error: "Stanza non trovata o non disponibile",
          code: "ROOM_NOT_FOUND",
        };
      }
    } else {
      const room = await prisma.room.findFirst({
        where: { slug: roomSlug, isActive: true },
        select: { id: true },
      });

      if (!room) {
        return {
          success: false,
          error: "Stanza non trovata o non disponibile",
          code: "ROOM_NOT_FOUND",
        };
      }

      roomId = room.id;
    }

    const closedDates = await getMonthClosedDatesForRoom(
      roomId,
      year,
      month - 1,
    );

    return {
      success: true,
      data: { closedDates },
    };
  } catch (error) {
    console.error("[getMonthClosedDates]", error);
    return {
      success: false,
      error: "Errore durante il recupero delle chiusure del calendario",
      code: "INTERNAL_ERROR",
    };
  }
}

export async function getMonthAvailability(
  prevState: unknown,
  formData: FormData,
): Promise<BookingActionResult<MonthAvailabilityPayload>> {
  const parsed = getMonthAvailabilitySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
      code: "VALIDATION_ERROR",
    };
  }

  const { roomSlug, roomId: providedRoomId, year, month } = parsed.data;

  try {
    let roomId = providedRoomId;
    let durationMinutes: number;

    if (roomId) {
      const room = await prisma.room.findFirst({
        where: { id: roomId, slug: roomSlug, isActive: true },
        select: { id: true, durationMinutes: true },
      });

      if (!room) {
        return {
          success: false,
          error: "Stanza non trovata o non disponibile",
          code: "ROOM_NOT_FOUND",
        };
      }

      durationMinutes = room.durationMinutes;
    } else {
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

      roomId = room.id;
      durationMinutes = room.durationMinutes;
    }

    const days = await getRoomMonthAvailability(
      roomId,
      durationMinutes,
      year,
      month - 1,
    );

    return {
      success: true,
      data: { days },
    };
  } catch (error) {
    console.error("[getMonthAvailability]", error);
    return {
      success: false,
      error: "Errore durante il recupero della disponibilità del calendario",
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

  const { roomSlug, startTime, participantCount, minorCount, paymentChoice, discountCode } =
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

    const discountValidation = await validateDiscountCodeForUser(
      discountCode,
      session.user.id,
    );

    if (!discountValidation.ok) {
      return {
        success: false,
        error: discountValidation.error,
        code: "DISCOUNT_INVALID",
      };
    }

    const discountedTotal = discountValidation.discount
      ? applyDiscountPercent(tier.totalPrice, discountValidation.discount.discountPercent)
      : tier.totalPrice;

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
            totalAmount: discountedTotal,
            status: BookingStatus.PENDING,
            holdExpiresAt,
            paymentChoice,
            participantCount,
            minorCount,
            discountCodeId: discountValidation.discount?.id ?? null,
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
        totalAmount: formatEuroAmount(discountedTotal),
        depositAmount: formatEuroAmount(
          discountValidation.discount
            ? applyDiscountPercent(
                tier.depositPrice,
                discountValidation.discount.discountPercent,
              )
            : tier.depositPrice,
        ),
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
      const target = error.meta?.target;
      if (
        Array.isArray(target) &&
        target.some((field) => String(field).includes("discountCodeId"))
      ) {
        return {
          success: false,
          error:
            "Questo codice sconto è già associato a un'altra prenotazione attiva",
          code: "DISCOUNT_INVALID",
        };
      }

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
      include: {
        room: { include: { pricingTiers: true } },
        discountCode: true,
      },
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

    if (booking.discountCodeId && booking.discountCode) {
      // Ri-validiamo il codice sconto al momento di creare la sessione di
      // pagamento: tra l'hold e il checkout un admin potrebbe averlo
      // disattivato, un'altra prenotazione potrebbe averlo consumato, o
      // potrebbe essere scaduto. Senza questo controllo l'utente pagherebbe
      // un importo scontato non piu' autorizzato.
      const discountRevalidation = await validateDiscountCodeForUser(
        booking.discountCode.code,
        session.user.id,
        { excludeBookingId: booking.id },
      );

      if (!discountRevalidation.ok) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { discountCodeId: null },
        });
        logError(
          "createStripeCheckoutSession",
          "Codice sconto non più valido al momento del checkout",
          { bookingId: booking.id, reason: discountRevalidation.error },
        );
        return {
          success: false,
          error: `Il codice sconto applicato non è più valido (${discountRevalidation.error}). Ricarica la pagina e riprova.`,
          code: "DISCOUNT_INVALID",
        };
      }
    }

    const chargeAmount = getBookingChargeAmount(booking, tier);

    const unitAmount = decimalToStripeCents(chargeAmount);

    if (unitAmount <= 0) {
      return {
        success: false,
        error: "Importo di pagamento non valido",
        code: "INVALID_AMOUNT",
      };
    }

    const stripeConfigError = getStripeConfigurationError();
    if (stripeConfigError) {
      return {
        success: false,
        error: stripeConfigError,
        code: "STRIPE_NOT_CONFIGURED",
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
      logError(
        "createStripeCheckoutSession",
        "Stripe checkout session creation failed",
        {
          bookingId: booking.id,
          message: stripeError instanceof Error ? stripeError.message : String(stripeError),
        },
      );

      const configError = isStripeConfigurationError(stripeError);

      if (!configError) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.CANCELLED,
            holdExpiresAt: null,
          },
        });
      }

      return {
        success: false,
        error: "Pagamento temporaneamente non disponibile. Riprova più tardi o contattaci.",
        code: configError ? "STRIPE_NOT_CONFIGURED" : "STRIPE_ERROR",
      };
    }

    if (!checkoutSession.url) {
      logError(
        "createStripeCheckoutSession",
        "Stripe session created without checkout URL",
        { sessionId: checkoutSession.id },
      );

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
    logError("createStripeCheckoutSession", "Unexpected error", {
      bookingId,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: "Errore durante la creazione della sessione di pagamento",
      code: "INTERNAL_ERROR",
    };
  }
}

type CancelMyBookingPayload = {
  refunded: boolean;
};

export async function cancelMyBooking(
  prevState: unknown,
  formData: FormData,
): Promise<BookingActionResult<CancelMyBookingPayload>> {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Devi effettuare l'accesso per annullare una prenotazione",
      code: "UNAUTHORIZED",
    };
  }

  const rateLimit = await checkRateLimit("cancelMyBooking", 5, {
    userId: session.user.id,
  });
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Troppe richieste. Riprova tra ${rateLimit.retryAfterSeconds} secondi.`,
      code: "RATE_LIMITED",
    };
  }

  const parsed = cancelMyBookingSchema.safeParse(formDataToObject(formData));
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
      include: {
        payments: { where: { status: PaymentStatus.SUCCEEDED } },
      },
    });

    // notFound-style generico: non confermiamo l'esistenza di una
    // prenotazione altrui a chi non ne e' il proprietario.
    if (!booking || booking.userId !== session.user.id) {
      return {
        success: false,
        error: "Prenotazione non trovata",
        code: "BOOKING_NOT_FOUND",
      };
    }

    const eligibility = getCancellationEligibility(booking);

    if (eligibility.kind === "NOT_CANCELLABLE") {
      return {
        success: false,
        error: "Questa prenotazione non può essere annullata",
        code: "NOT_CANCELLABLE",
      };
    }

    if (eligibility.kind === "MANUAL_REVIEW") {
      return {
        success: false,
        error:
          "Questa prenotazione richiede l'intervento dell'assistenza: contattaci per procedere.",
        code: "MANUAL_REVIEW",
      };
    }

    if (eligibility.kind === "PAST_CUTOFF") {
      return {
        success: false,
        error:
          "Non è possibile annullare entro 48 ore dall'inizio dell'evento. Contattaci per casi eccezionali.",
        code: "PAST_CUTOFF",
      };
    }

    if (eligibility.kind === "FREE_CANCEL") {
      const claimed = await prisma.booking.updateMany({
        where: {
          id: bookingId,
          userId: session.user.id,
          status: BookingStatus.PENDING,
        },
        data: { status: BookingStatus.CANCELLED, holdExpiresAt: null },
      });

      if (claimed.count !== 1) {
        return {
          success: false,
          error: "Questa prenotazione è già stata aggiornata. Ricarica la pagina.",
          code: "ALREADY_HANDLED",
        };
      }

      revalidatePath("/account");
      return { success: true, data: { refunded: false } };
    }

    // REFUND_ELIGIBLE: booking PAID o DEPOSIT_PAID, evento a piu' di 48h.
    if (booking.payments.length === 0) {
      // Non dovrebbe accadere per uno stato PAID/DEPOSIT_PAID (il webhook
      // registra sempre il pagamento prima di confermare), ma non rischiamo
      // di liberare lo slot senza alcuna traccia di un pagamento da
      // rimborsare: segnaliamo per revisione manuale invece di annullare.
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
          holdExpiresAt: null,
        },
      });
      logError(
        "cancelMyBooking",
        "Booking PAID/DEPOSIT_PAID senza pagamenti registrati",
        { bookingId, userId: session.user.id },
      );
      await sendStripeOpsAlert({
        subject: "Annullamento utente senza pagamento registrato",
        details: { bookingId, userId: session.user.id, status: booking.status },
      });
      return {
        success: false,
        error: "Errore interno durante l'annullamento. Contattaci per assistenza.",
        code: "INTERNAL_ERROR",
      };
    }

    const originalStatus = booking.status;

    const claimed = await prisma.booking.updateMany({
      where: { id: bookingId, userId: session.user.id, status: originalStatus },
      data: { status: BookingStatus.CANCELLED, holdExpiresAt: null },
    });

    if (claimed.count !== 1) {
      return {
        success: false,
        error: "Questa prenotazione è già stata aggiornata. Ricarica la pagina.",
        code: "ALREADY_HANDLED",
      };
    }

    // Rimborso per-pagamento: ogni pagamento viene rimborsato e marcato
    // REFUNDED individualmente, subito dopo il successo della singola
    // chiamata Stripe. Non aspettiamo la fine del loop per scrivere sul DB,
    // cosi' un fallimento su un pagamento successivo non lascia un rimborso
    // gia' incassato dal cliente senza traccia nel nostro sistema.
    const refundedPaymentIds: string[] = [];
    const failedPayments: Array<{ paymentId: string; error: string }> = [];

    for (const payment of booking.payments) {
      try {
        await stripe.refunds.create(
          { payment_intent: payment.stripePaymentId },
          { idempotencyKey: `refund-${payment.id}` },
        );
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.REFUNDED },
        });
        refundedPaymentIds.push(payment.id);
      } catch (stripeError) {
        const message =
          stripeError instanceof Error ? stripeError.message : String(stripeError);
        logError("cancelMyBooking", "Rimborso Stripe fallito per un pagamento", {
          bookingId,
          paymentId: payment.id,
          error: message,
        });
        failedPayments.push({ paymentId: payment.id, error: message });
      }
    }

    if (failedPayments.length === 0) {
      revalidatePath("/account");
      return { success: true, data: { refunded: true } };
    }

    if (refundedPaymentIds.length === 0) {
      // Nessun rimborso e' andato a buon fine: nessun denaro si e' mosso,
      // quindi e' sicuro ripristinare lo stato originale e far ritentare
      // l'utente.
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: originalStatus },
      });
      await sendStripeOpsAlert({
        subject: "Rimborso self-service fallito",
        details: { bookingId, userId: session.user.id, originalStatus, failedPayments },
      });
      return {
        success: false,
        error: "Rimborso non riuscito. Riprova tra qualche minuto o contattaci.",
        code: "STRIPE_ERROR",
      };
    }

    // Rimborso parziale: almeno un pagamento e' stato restituito da Stripe,
    // almeno un altro no. Non possiamo ripristinare lo stato originale
    // (nasconderebbe che parte del denaro e' gia' uscito) né considerare
    // l'operazione riuscita: serve intervento manuale per riconciliare.
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED },
    });
    logError(
      "cancelMyBooking",
      "Rimborso parziale: intervento manuale richiesto",
      { bookingId, userId: session.user.id, refundedPaymentIds, failedPayments },
    );
    await sendStripeOpsAlert({
      subject: "Rimborso self-service parziale - intervento manuale richiesto",
      details: { bookingId, userId: session.user.id, refundedPaymentIds, failedPayments },
    });
    return {
      success: false,
      error:
        "Rimborso parzialmente completato. Il nostro staff verificherà la situazione: contattaci per assistenza.",
      code: "PARTIAL_REFUND",
    };
  } catch (error) {
    logError(
      "cancelMyBooking",
      "Unexpected error",
      { message: error instanceof Error ? error.message : String(error) },
    );
    return {
      success: false,
      error: "Errore durante l'annullamento della prenotazione",
      code: "INTERNAL_ERROR",
    };
  }
}

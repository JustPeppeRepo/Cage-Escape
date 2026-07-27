import { z } from "zod";
import { PaymentType } from "@/generated/prisma/client";
import { getRomeDateString } from "@/app/_lib/bookings/slots";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function isTodayOrFuture(dateStr: string): boolean {
  // Confronto in fuso Europe/Rome (coerente con il resto del modulo slots),
  // non nel fuso locale del server: su Vercel il server gira in UTC, e un
  // confronto naive con `new Date()` produce una finestra di alcune ore
  // intorno alla mezzanotte in cui la data "oggi" percepita differisce da
  // quella reale a Roma.
  const todayRome = getRomeDateString(new Date());
  return dateStr >= todayRome;
}

export const getAvailableSlotsSchema = z.object({
  roomSlug: z.string().trim().min(1).max(64),
  roomId: z.string().trim().min(1).max(64).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(480).optional(),
  date: z
    .string()
    .regex(dateRegex, "Formato data non valido (YYYY-MM-DD)")
    .refine(isTodayOrFuture, "La data non può essere nel passato"),
});

export const getMonthClosedDatesSchema = z.object({
  roomSlug: z.string().trim().min(1).max(64),
  roomId: z.string().trim().min(1).max(64).optional(),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const holdSlotSchema = z
  .object({
    roomSlug: z.string().trim().min(1).max(64),
    startTime: z.string().datetime({ offset: true }),
    participantCount: z.coerce.number().int().min(1),
    minorCount: z.coerce.number().int().min(0).default(0),
    paymentChoice: z.enum([PaymentType.FULL, PaymentType.DEPOSIT]),
    discountCode: z.string().trim().max(32).optional().or(z.literal("")),
  })
  .refine((data) => data.minorCount <= data.participantCount, {
    message: "Il numero di minorenni non può superare i partecipanti",
    path: ["minorCount"],
  })
  .refine(
    (data) =>
      data.paymentChoice === PaymentType.FULL ||
      !data.discountCode ||
      data.discountCode.length === 0,
    {
      message:
        "Il codice sconto è disponibile solo con il pagamento del saldo completo",
      path: ["discountCode"],
    },
  );

export const createStripeCheckoutSessionSchema = z.object({
  bookingId: z.string().cuid().max(64),
});

export const cancelMyBookingSchema = z.object({
  bookingId: z.string().cuid().max(64),
});

export type GetAvailableSlotsInput = z.infer<typeof getAvailableSlotsSchema>;
export type GetMonthClosedDatesInput = z.infer<typeof getMonthClosedDatesSchema>;
export type HoldSlotInput = z.infer<typeof holdSlotSchema>;
export type CreateStripeCheckoutSessionInput = z.infer<
  typeof createStripeCheckoutSessionSchema
>;
export type CancelMyBookingInput = z.infer<typeof cancelMyBookingSchema>;

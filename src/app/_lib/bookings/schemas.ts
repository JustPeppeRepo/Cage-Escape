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
  roomSlug: z.string().min(1),
  date: z
    .string()
    .regex(dateRegex, "Formato data non valido (YYYY-MM-DD)")
    .refine(isTodayOrFuture, "La data non può essere nel passato"),
});

export const holdSlotSchema = z
  .object({
    roomSlug: z.string().min(1),
    startTime: z.string().datetime({ offset: true }),
    participantCount: z.coerce.number().int().min(1),
    minorCount: z.coerce.number().int().min(0).default(0),
    paymentChoice: z.enum([PaymentType.FULL, PaymentType.DEPOSIT]),
  })
  .refine((data) => data.minorCount <= data.participantCount, {
    message: "Il numero di minorenni non può superare i partecipanti",
    path: ["minorCount"],
  });

export const createStripeCheckoutSessionSchema = z.object({
  bookingId: z.string().min(1),
});

export type GetAvailableSlotsInput = z.infer<typeof getAvailableSlotsSchema>;
export type HoldSlotInput = z.infer<typeof holdSlotSchema>;
export type CreateStripeCheckoutSessionInput = z.infer<
  typeof createStripeCheckoutSessionSchema
>;

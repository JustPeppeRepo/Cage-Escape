import { BookingStatus } from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import { getSiteSettings } from "@/app/_lib/admin/site-settings";

export type ValidatedDiscountCode = {
  id: string;
  code: string;
  discountPercent: number;
};

export async function validateDiscountCodeForUser(
  rawCode: string | undefined,
  userId: string,
  options?: { excludeBookingId?: string },
): Promise<
  | { ok: true; discount: ValidatedDiscountCode | null }
  | { ok: false; error: string }
> {
  const normalized = rawCode?.trim().toUpperCase();
  if (!normalized) {
    return { ok: true, discount: null };
  }

  const settings = await getSiteSettings();
  if (!settings.easterEggDiscountEnabled) {
    return { ok: false, error: "Gli sconti non sono attualmente disponibili" };
  }

  const discount = await prisma.discountCode.findUnique({
    where: { code: normalized },
  });

  if (!discount || discount.userId !== userId) {
    return { ok: false, error: "Codice sconto non valido" };
  }

  if (discount.used) {
    return { ok: false, error: "Questo codice sconto è già stato utilizzato" };
  }

  if (discount.expiresAt <= new Date()) {
    return { ok: false, error: "Questo codice sconto è scaduto" };
  }

  if (discount.discountPercent !== settings.easterEggDiscountPercent) {
    return { ok: false, error: "Codice sconto non più valido" };
  }

  const now = new Date();
  const activeBooking = await prisma.booking.findFirst({
    where: {
      discountCodeId: discount.id,
      ...(options?.excludeBookingId ? { id: { not: options.excludeBookingId } } : {}),
      OR: [
        {
          status: {
            in: [
              BookingStatus.DEPOSIT_PAID,
              BookingStatus.PAID,
              // Un pagamento in conflitto ha comunque incassato il denaro:
              // il codice non deve essere considerato libero finche' il
              // conflitto non e' risolto manualmente.
              BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED,
            ],
          },
        },
        {
          status: BookingStatus.PENDING,
          holdExpiresAt: { gt: now },
        },
      ],
    },
    select: { id: true },
  });

  if (activeBooking) {
    return {
      ok: false,
      error: "Questo codice sconto è già associato a un'altra prenotazione attiva",
    };
  }

  return {
    ok: true,
    discount: {
      id: discount.id,
      code: discount.code,
      discountPercent: discount.discountPercent,
    },
  };
}

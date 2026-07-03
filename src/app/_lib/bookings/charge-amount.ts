import { Prisma } from "@/generated/prisma/client";
import { PaymentType } from "@/generated/prisma/client";
import { applyDiscountPercent } from "@/app/_lib/admin/discount";
import { decimalToNumber } from "@/app/_lib/bookings/money";

type DecimalLike = Prisma.Decimal | { toString(): string };

type TierLike = {
  totalPrice: DecimalLike;
  depositPrice: DecimalLike;
};

function toDecimal(value: DecimalLike): Prisma.Decimal {
  return value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value.toString());
}

type BookingLike = {
  paymentChoice: PaymentType;
  discountCode?: { discountPercent: number } | null;
};

export function getBookingChargeAmount(
  booking: BookingLike,
  tier: TierLike,
): Prisma.Decimal {
  const base =
    booking.paymentChoice === PaymentType.FULL
      ? toDecimal(tier.totalPrice)
      : toDecimal(tier.depositPrice);

  if (!booking.discountCode) {
    return base;
  }

  return applyDiscountPercent(base, booking.discountCode.discountPercent);
}

export function getBookingChargeAmountNumber(
  booking: BookingLike,
  tier: TierLike,
): number {
  return decimalToNumber(getBookingChargeAmount(booking, tier));
}

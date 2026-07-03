import { Prisma } from "@/generated/prisma/client";

export function applyDiscountPercent(
  amount: Prisma.Decimal,
  discountPercent: number,
): Prisma.Decimal {
  const factor = (100 - discountPercent) / 100;
  return amount.mul(factor);
}

export function generateDiscountCodeValue(): string {
  const segment = () =>
    Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RITO-${segment()}-${segment()}`;
}

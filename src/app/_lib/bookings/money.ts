import { Prisma } from "@/generated/prisma/client";

type DecimalLike = { toString(): string };

export function decimalToNumber(value: DecimalLike | number | string): number {
  return Number(value.toString());
}

export function decimalToStripeCents(value: DecimalLike | number | string): number {
  return Math.round(decimalToNumber(value) * 100);
}

/** Converte centesimi Stripe (intero) in Decimal euro senza float intermedi. */
export function stripeCentsToDecimal(cents: number): Prisma.Decimal {
  return new Prisma.Decimal(cents).div(100);
}

export function formatEuroAmount(value: DecimalLike | number | string): string {
  return decimalToNumber(value).toFixed(2);
}

import { randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function applyDiscountPercent(
  amount: Prisma.Decimal,
  discountPercent: number,
): Prisma.Decimal {
  const factor = (100 - discountPercent) / 100;
  return amount.mul(factor);
}

function randomSegment(length = 4): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

export function generateDiscountCodeValue(): string {
  return `RITO-${randomSegment()}-${randomSegment()}`;
}

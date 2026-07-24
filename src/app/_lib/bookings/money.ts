type DecimalLike = { toString(): string };

export function decimalToNumber(value: DecimalLike | number | string): number {
  return Number(value.toString());
}

export function decimalToStripeCents(value: DecimalLike | number | string): number {
  return Math.round(decimalToNumber(value) * 100);
}

/**
 * Centesimi Stripe → stringa euro a 2 decimali (niente float).
 * Usare con `new Prisma.Decimal(...)` solo in codice server.
 */
export function stripeCentsToEuroFixed(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${negative ? "-" : ""}${whole}.${frac.toString().padStart(2, "0")}`;
}

export function formatEuroAmount(value: DecimalLike | number | string): string {
  return decimalToNumber(value).toFixed(2);
}

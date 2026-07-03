type PricingTierLike = {
  minParticipants: number;
  maxParticipants: number;
  totalPrice: { toString(): string };
  depositPrice: { toString(): string };
};

export function resolvePricingTier<T extends PricingTierLike>(
  tiers: T[],
  participantCount: number,
): T | null {
  return (
    tiers.find(
      (tier) =>
        participantCount >= tier.minParticipants &&
        participantCount <= tier.maxParticipants,
    ) ?? null
  );
}

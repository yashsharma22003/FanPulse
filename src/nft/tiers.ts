export const TIER_NAMES = [
  'ROOKIE',
  'SCOUT',
  'ANALYST',
  'EXPERT',
  'ORACLE',
] as const;

export type FanNftTierName = (typeof TIER_NAMES)[number];

/** Scout is the first minted tier. Rookie (< 1000) has no NFT until a later mint. */
export const SCOUT_TIER = 1;

export function tierFromRating(rating: number): number {
  if (rating < 1000) return 0;
  if (rating < 1200) return 1;
  if (rating < 1400) return 2;
  if (rating < 1600) return 3;
  return 4;
}

export function tierName(tier: number): FanNftTierName {
  return TIER_NAMES[tier] ?? 'ROOKIE';
}

/** FanPulse API types. */
export interface HealthStatus {
  status: string;
}

export interface AuthNonce {
  nonce: string;
  domain: string;
  uri: string;
  chainId: number;
  expiresAt: string;
}

export interface SiweLoginInput {
  message: string;
  signature: string;
}

export type FanNftTier = typeof FanNftTier[keyof typeof FanNftTier];


export const FanNftTier = {
  ROOKIE: 'ROOKIE',
  SCOUT: 'SCOUT',
  ANALYST: 'ANALYST',
  EXPERT: 'EXPERT',
  ORACLE: 'ORACLE',
} as const;

export interface FanNft {
  tier: FanNftTier;
  progress: number;
  /** @nullable */
  nextTier: string | null;
  /** @nullable */
  lastUpdateTxHash: string | null;
}

export interface User {
  id: string;
  wallet: string;
  challengeEnergy: number;
  challengeRating: number;
  wins: number;
  losses: number;
  fanNft?: FanNft;
}

export interface AuthLoginResponse {
  token: string;
  user: User;
}

export type MarketAiStatus = typeof MarketAiStatus[keyof typeof MarketAiStatus];


export const MarketAiStatus = {
  IDLE: 'IDLE',
  PENDING: 'PENDING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;

export interface Market {
  id: string;
  marketId: string;
  asset: string;
  intervalSec: number;
  /** @nullable */
  tradingStart: string | null;
  expiry: string;
  /** @nullable */
  pool: string | null;
  /** @nullable */
  venueId: string | null;
  onchainStatus: number;
  /** @nullable */
  aiPercent: number | null;
  aiStatus: MarketAiStatus;
  secondsLeft: number;
  tradable: boolean;
}

/**
 * @nullable
 */
export type MarketDetailWinningOutcome = typeof MarketDetailWinningOutcome[keyof typeof MarketDetailWinningOutcome] | null;


export const MarketDetailWinningOutcome = {
  NUMBER_0: 0,
  NUMBER_1: 1,
} as const;

export interface Odds {
  /** @nullable */
  pUp: number | null;
  /** @nullable */
  bestBid: number | null;
  /** @nullable */
  bestAsk: number | null;
}

export type MarketDetail = Market & ({
  isResolved: boolean;
  isVoided: boolean;
  /** @nullable */
  winningOutcome: MarketDetailWinningOutcome;
  odds: Odds;
  /** @nullable */
  communityPercent: number | null;
  /** @nullable */
  userPercent: number | null;
  /** @nullable */
  openingPrice: string | null;
  /** @nullable */
  question: string | null;
});

export interface UnsignedTx {
  to: string;
  data: string;
  value: string;
  chainId: number;
  description: string;
}

export type PredictionInputDirection = typeof PredictionInputDirection[keyof typeof PredictionInputDirection];


export const PredictionInputDirection = {
  UP: 'UP',
  DOWN: 'DOWN',
} as const;

export interface PredictionInput {
  marketId: string;
  direction: PredictionInputDirection;
  /**
     * @minimum 1
     * @maximum 99
     */
  confidence: number;
  /** @minimum 0 */
  quantity?: number;
}

export type ChallengeInputDirection = typeof ChallengeInputDirection[keyof typeof ChallengeInputDirection];


export const ChallengeInputDirection = {
  UP: 'UP',
  DOWN: 'DOWN',
} as const;

export interface ChallengeInput {
  direction: ChallengeInputDirection;
  /**
     * @minimum 1
     * @maximum 99
     */
  confidence: number;
  /** @minimum 0 */
  quantity?: number;
}

export interface TxConfirmInput {
  txHash: string;
}

export type PredictionDirection = typeof PredictionDirection[keyof typeof PredictionDirection];


export const PredictionDirection = {
  UP: 'UP',
  DOWN: 'DOWN',
} as const;

export type PredictionStatus = typeof PredictionStatus[keyof typeof PredictionStatus];


export const PredictionStatus = {
  PENDING: 'PENDING',
  OPEN: 'OPEN',
  LOCKED: 'LOCKED',
  EXPIRED: 'EXPIRED',
} as const;

export interface Prediction {
  id: string;
  marketId: string;
  wallet: string;
  direction: PredictionDirection;
  confidence: number;
  quantityFilled: number;
  status: PredictionStatus;
  /** @nullable */
  challengeExpiresAt: string | null;
  createdAt: string;
}

export type PreparedOrderDirection = typeof PreparedOrderDirection[keyof typeof PreparedOrderDirection];


export const PreparedOrderDirection = {
  UP: 'UP',
  DOWN: 'DOWN',
} as const;

export interface PreparedOrder {
  marketId: string;
  pool: string;
  collateral: string;
  side: string;
  kind: string;
  direction: PreparedOrderDirection;
  quantityHuman: number;
  priceHuman: number;
  decimals: number;
  approval: UnsignedTx;
  order: UnsignedTx;
}

export interface PreparedPrediction {
  prediction: Prediction;
  order: PreparedOrder;
}

export interface PreparedChallenge {
  prediction: Prediction;
  originalPredictionId: string;
  order: PreparedOrder;
}

export type ChallengeStatus = typeof ChallengeStatus[keyof typeof ChallengeStatus];


export const ChallengeStatus = {
  LOCKED: 'LOCKED',
  RESOLVED: 'RESOLVED',
  VOIDED: 'VOIDED',
  EXPIRED: 'EXPIRED',
} as const;

export type ChallengeSideDirection = typeof ChallengeSideDirection[keyof typeof ChallengeSideDirection];


export const ChallengeSideDirection = {
  UP: 'UP',
  DOWN: 'DOWN',
} as const;

export interface ChallengeSide {
  id: string;
  wallet: string;
  direction: ChallengeSideDirection;
  confidence: number;
  quantityFilled: number;
}

export type ChallengeMarket = {
  marketId: string;
  asset: string;
};

export interface Challenge {
  id: string;
  status: ChallengeStatus;
  /** @nullable */
  multiplier: number | null;
  /** @nullable */
  energyPaid: number | null;
  /** @nullable */
  resolvedAt: string | null;
  /** @nullable */
  winnerWallet: string | null;
  market: ChallengeMarket;
  original: ChallengeSide;
  challenger: ChallengeSide;
}

export interface PredictionConfirmation {
  prediction: Prediction;
  challenge?: Challenge;
}

export type OpenPredictionDirection = typeof OpenPredictionDirection[keyof typeof OpenPredictionDirection];


export const OpenPredictionDirection = {
  UP: 'UP',
  DOWN: 'DOWN',
} as const;

export type OpenPredictionPredictor = {
  wallet: string;
  challengeRating: number;
  fanNft?: FanNft;
};

export type OpenPredictionMarket = {
  marketId: string;
  asset: string;
  intervalSec: number;
};

export interface OpenPrediction {
  id: string;
  direction: OpenPredictionDirection;
  confidence: number;
  quantityFilled: number;
  challengeExpiresAt: string;
  createdAt: string;
  predictor: OpenPredictionPredictor;
  market: OpenPredictionMarket;
}

export type HistoryEntryDirection = typeof HistoryEntryDirection[keyof typeof HistoryEntryDirection];


export const HistoryEntryDirection = {
  UP: 'UP',
  DOWN: 'DOWN',
} as const;

export type HistoryEntryResult = typeof HistoryEntryResult[keyof typeof HistoryEntryResult];


export const HistoryEntryResult = {
  WIN: 'WIN',
  LOSS: 'LOSS',
  VOID: 'VOID',
  OPEN: 'OPEN',
} as const;

export interface HistoryEntry {
  id: string;
  asset: string;
  direction: HistoryEntryDirection;
  result: HistoryEntryResult;
  energy: number;
  createdAt: string;
}

export interface UserProfile {
  wallet: string;
  challengeEnergy: number;
  challengeRating: number;
  wins: number;
  losses: number;
  fanNft: FanNft;
  history: HistoryEntry[];
}

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  challengeEnergy: number;
  challengeRating: number;
  wins: number;
  losses: number;
  fanNft?: FanNft;
}

export type GetLeaderboardParams = {
sort?: GetLeaderboardSort;
};

export type GetLeaderboardSort = typeof GetLeaderboardSort[keyof typeof GetLeaderboardSort];


export const GetLeaderboardSort = {
  energy: 'energy',
  rating: 'rating',
} as const;


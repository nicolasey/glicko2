/**
 * Types and interfaces for the Glicko-2 rating system
 * Based on the algorithm developed by Mark E. Glickman
 */

/** Match result: win = 1, loss = 0, draw = 0.5 */
export type MatchResult = 1 | 0.5 | 0;

/** Immutable snapshot of a player before/after an update */
export interface PlayerSnapshot {
  rating: number;
  rd: number;
  volatility: number;
}

/** Glicko-2 system configuration */
export interface Glicko2Config {
  /** Tau - volatility constraint (default: 0.5) */
  tau: number;
  /** Epsilon for convergence (default: 0.000001) */
  epsilon: number;
  /** Default rating period in seconds */
  ratingPeriod: number;
  /** Initial rating (default: 1500) */
  defaultRating: number;
  /** Initial deviation (default: 350) */
  defaultRd: number;
  /** Initial volatility (default: 0.06) */
  defaultVolatility: number;
  /** Hook called after each rating update (XP, badges, logs…) */
  onRatingUpdate?: (playerId: string, prev: PlayerSnapshot, next: PlayerSnapshot) => void;
}

/** Partial configuration for updates */
export type PartialConfig = Partial<Glicko2Config>;

/** Player data */
export interface PlayerData {
  id: string;
  rating: number;
  rd: number; // Rating deviation
  volatility: number;
  lastRatingPeriod?: Date;
}

/** Match result from a single player's perspective */
export interface MatchOutcome {
  opponentId: string;
  result: MatchResult;
  opponentRating: number;
  opponentRd: number;
}

/** Match between two players */
export interface Match {
  player1Id: string;
  player2Id: string;
  result: MatchResult; // From player 1's point of view
  timestamp?: Date;
}

/** Newly computed rating for a player */
export interface RatingUpdate {
  rating: number;
  rd: number;
  volatility: number;
}

/** Math constants */
export const CONSTANTS = {
  /** ln(10) / 400 - conversion factor */
  Q: Math.log(10) / 400,
  /** Glicko-1 to Glicko-2 conversion (scale) */
  SCALE: 173.7178,
  /** Default initial rating (Glicko-1) */
  DEFAULT_RATING: 1500,
  /** Default initial deviation */
  DEFAULT_RD: 350,
  /** Default initial volatility */
  DEFAULT_VOLATILITY: 0.06,
  /** Default tau value */
  DEFAULT_TAU: 0.5,
  /** Convergence precision */
  DEFAULT_EPSILON: 0.000001,
} as const;

/** Default configuration */
export const DEFAULT_CONFIG: Glicko2Config = {
  tau: CONSTANTS.DEFAULT_TAU,
  epsilon: CONSTANTS.DEFAULT_EPSILON,
  ratingPeriod: 86400, // 1 day in seconds
  defaultRating: CONSTANTS.DEFAULT_RATING,
  defaultRd: CONSTANTS.DEFAULT_RD,
  defaultVolatility: CONSTANTS.DEFAULT_VOLATILITY,
};

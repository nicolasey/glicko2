/**
 * Types et interfaces pour le système de classement Glicko-2
 * Basé sur l'algorithme développé par Mark E. Glickman
 */

/** Résultat d'un match : victoire = 1, défaite = 0, match nul = 0.5 */
export type MatchResult = 1 | 0.5 | 0;

/** Configuration du système Glicko-2 */
export interface Glicko2Config {
  /** Tau - contrainte sur la volatilité (valeur par défaut : 0.5) */
  tau: number;
  /** Epsilon pour la convergence (valeur par défaut : 0.000001) */
  epsilon: number;
  /** Période de rating par défaut en secondes */
  ratingPeriod: number;
  /** Rating initial (valeur par défaut : 1500) */
  defaultRating: number;
  /** Déviation initiale (valeur par défaut : 350) */
  defaultRd: number;
  /** Volatilité initiale (valeur par défaut : 0.06) */
  defaultVolatility: number;
}

/** Configuration partielle pour les mises à jour */
export type PartialConfig = Partial<Glicko2Config>;

/** Données d'un joueur */
export interface PlayerData {
  id: string;
  rating: number;
  rd: number; // Rating deviation
  volatility: number;
  lastRatingPeriod?: Date;
}

/** Résultat d'un match pour un joueur */
export interface MatchOutcome {
  opponentId: string;
  result: MatchResult;
  opponentRating: number;
  opponentRd: number;
}

/** Match entre deux joueurs */
export interface Match {
  player1Id: string;
  player2Id: string;
  result: MatchResult; // Du point de vue du joueur 1
  timestamp?: Date;
}

/** Nouveau calcul de rating pour un joueur */
export interface RatingUpdate {
  rating: number;
  rd: number;
  volatility: number;
}

/** Constantes mathématiques */
export const CONSTANTS = {
  /** ln(10) / 400 - facteur de conversion */
  Q: Math.log(10) / 400,
  /** Conversion du système Glicko-1 au système Glicko-2 (échelle) */
  SCALE: 173.7178,
  /** Rating initial par défaut (Glicko-1) */
  DEFAULT_RATING: 1500,
  /** Déviation initiale par défaut */
  DEFAULT_RD: 350,
  /** Volatilité initiale par défaut */
  DEFAULT_VOLATILITY: 0.06,
  /** Valeur par défaut de tau */
  DEFAULT_TAU: 0.5,
  /** Précision pour la convergence */
  DEFAULT_EPSILON: 0.000001,
} as const;

/** Configuration par défaut */
export const DEFAULT_CONFIG: Glicko2Config = {
  tau: CONSTANTS.DEFAULT_TAU,
  epsilon: CONSTANTS.DEFAULT_EPSILON,
  ratingPeriod: 86400, // 1 jour en secondes
  defaultRating: CONSTANTS.DEFAULT_RATING,
  defaultRd: CONSTANTS.DEFAULT_RD,
  defaultVolatility: CONSTANTS.DEFAULT_VOLATILITY,
};

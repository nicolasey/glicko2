import type { MatchResult } from "../types.ts";
import type { Player } from "../player.ts";

/**
 * Types d'effets qu'un badge peut avoir sur les calculs de rating
 */
export type BadgeEffectType = 
  | "rating_multiplier"      // Multiplie le gain/perte de rating
  | "win_streak_boost"       // Bonus basé sur une série de victoires
  | "loss_protection"        // Réduit les pertes de rating
  | "underdog_bonus"         // Bonus quand on bat un meilleur adversaire
  | "rd_boost"               // Réduit la déviation plus vite
  | "volatility_reduction"   // Réduit la volatilité
  | "consolation"           // Bonus après une défaite
  | "experience_boost";      // Bonus d'XP (système parallèle)

/**
 * Contexte d'un match pour évaluer les conditions d'un badge
 */
export interface MatchContext {
  player: Player;
  opponent: Player;
  result: MatchResult;
  expectedScore: number;      // Probabilité de victoire attendue
  ratingChange: number;       // Changement de rating calculé (avant effets)
  isUnderdog: boolean;        // Le joueur était-il outsider ?
  winStreak: number;          // Série de victoires actuelle
  totalMatches: number;       // Nombre total de matchs joués
  consecutiveLosses: number;  // Série de défaites actuelle
}

/**
 * Condition pour activer un badge
 */
export type BadgeCondition = 
  | { type: "always" }
  | { type: "win" }
  | { type: "loss" }
  | { type: "draw" }
  | { type: "underdog_win" }           // Victoire en tant qu'outsider
  | { type: "win_streak_min"; count: number }
  | { type: "consecutive_losses_min"; count: number }
  | { type: "rating_above"; threshold: number }
  | { type: "rating_below"; threshold: number }
  | { type: "matches_played_min"; count: number }
  | { type: "matches_played_max"; count: number }
  | { type: "opponent_rating_above"; threshold: number }
  | { type: "opponent_rating_below"; threshold: number }
  | { type: "unexpected_result" }      // Victoire improbable ou défaite attendue
  | { type: "custom"; check: (context: MatchContext) => boolean };

/**
 * Effet d'un badge sur les calculs
 */
export interface BadgeEffect {
  type: BadgeEffectType;
  value: number;              // Valeur du multiplicateur ou bonus
  description: string;
}

/**
 * Configuration d'un badge
 */
export interface BadgeConfig {
  id: string;
  name: string;
  description: string;
  icon?: string;              // Emoji ou code d'icône
  rarity: "common" | "rare" | "epic" | "legendary";
  conditions: BadgeCondition[];
  effects: BadgeEffect[];
  duration?: number;          // Durée en nombre de matchs (undefined = permanent)
  stackable: boolean;         // Peut-on avoir plusieurs fois ce badge ?
  maxStacks?: number;         // Nombre max de stacks si stackable
}

/**
 * Instance d'un badge attribué à un joueur
 */
export interface PlayerBadge {
  badgeId: string;
  obtainedAt: Date;
  expiresAt?: Date;           // Si le badge a une durée limitée
  remainingUses?: number;     // Si le badge a un nombre d'utilisations limité
  stackCount: number;         // Nombre de stacks (si stackable)
  metadata?: Record<string, unknown>; // Données spécifiques au badge
}

/**
 * Historique des matchs pour calculer les séries
 */
export interface PlayerMatchHistory {
  results: Array<{
    timestamp: Date;
    result: MatchResult;
    opponentRating: number;
    ratingBefore: number;
    ratingAfter: number;
  }>;
}

/**
 * Système de points d'expérience (XP) parallèle au rating
 */
export interface XPSystem {
  currentXP: number;
  level: number;
  totalXP: number;
  nextLevelThreshold: number;
}

/**
 * Résultat modifié par les badges
 */
export interface ModifiedRatingResult {
  originalRating: number;
  modifiedRating: number;
  originalRd: number;
  modifiedRd: number;
  originalVolatility: number;
  modifiedVolatility: number;
  appliedEffects: Array<{
    badgeId: string;
    badgeName: string;
    effect: BadgeEffect;
    value: number;
  }>;
  xpGained: number;
  bonusReasons: string[];
}

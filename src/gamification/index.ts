/**
 * Module de gamification pour le système Glicko-2
 * 
 * Ce module étend le système de classement Glicko-2 avec des mécaniques de jeu :
 * - Système de badges avec effets sur les ratings
 * - Points d'expérience (XP) parallèles au rating
 * - Statistiques de matchs détaillées
 * - Conditions et effets personnalisables
 * 
 * @example
 * ```typescript
 * import { GamifiedGlicko2, BadgeEffects } from "./gamification";
 * 
 * // Créer le système
 * const glicko = new GamifiedGlicko2();
 * 
 * // Créer un badge personnalisé
 * glicko.getBadgeRegistry().register({
 *   id: "my_badge",
 *   name: "Mon Badge",
 *   description: "Bonus de 25%",
 *   rarity: "rare",
 *   conditions: [{ type: "win" }],
 *   effects: [BadgeEffects.ratingMultiplier(1.25)],
 *   stackable: false,
 * });
 * 
 * // Attribuer à un joueur
 * glicko.awardBadge("player1", "my_badge");
 * ```
 */

export { GamifiedGlicko2 } from "./gamified-glicko2.ts";
export { Badge, BadgeRegistry, BadgeEffects } from "./badge.ts";
export type {
  BadgeConfig,
  BadgeCondition,
  BadgeEffect,
  BadgeEffectType,
  MatchContext,
  PlayerBadge,
  ModifiedRatingResult,
  XPSystem,
  PlayerMatchHistory,
} from "./types.ts";

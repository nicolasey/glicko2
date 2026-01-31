import { Glicko2, Player, Match, Glicko2Calculator, type MatchResult, type PartialConfig } from "../glicko2.ts";
import type { MatchOutcome } from "../calculator.ts";
import { CONSTANTS, type RatingUpdate } from "../types.ts";
import { Badge, BadgeRegistry } from "./badge.ts";
import type { 
  MatchContext, 
  PlayerBadge, 
  ModifiedRatingResult, 
  BadgeEffect,
  XPSystem,
  PlayerMatchHistory 
} from "./types.ts";

/**
 * Données étendues d'un joueur avec gamification
 */
interface GamifiedPlayerData {
  badges: PlayerBadge[];
  matchHistory: PlayerMatchHistory;
  xp: XPSystem;
  stats: {
    wins: number;
    losses: number;
    draws: number;
    winStreak: number;
    consecutiveLosses: number;
    highestRating: number;
    lowestRating: number;
    totalMatches: number;
  };
}

/**
 * Système Glicko-2 avec gamification et badges
 * 
 * Étend le système de base avec :
 * - Système de badges avec effets sur les ratings
 * - Points d'expérience (XP) parallèle au rating
 * - Statistiques de matchs détaillées
 * - Bonus/malus basés sur les performances
 */
export class GamifiedGlicko2 extends Glicko2 {
  private badgeRegistry: BadgeRegistry;
  private playerGamificationData: Map<string, GamifiedPlayerData> = new Map();

  constructor(config: PartialConfig = {}) {
    super(config);
    this.badgeRegistry = BadgeRegistry.createDefaultBadges();
  }

  /**
   * Récupère ou crée les données de gamification d'un joueur
   */
  private getOrCreateGamificationData(playerId: string): GamifiedPlayerData {
    if (!this.playerGamificationData.has(playerId)) {
      this.playerGamificationData.set(playerId, {
        badges: [],
        matchHistory: { results: [] },
        xp: {
          currentXP: 0,
          level: 1,
          totalXP: 0,
          nextLevelThreshold: 100,
        },
        stats: {
          wins: 0,
          losses: 0,
          draws: 0,
          winStreak: 0,
          consecutiveLosses: 0,
          highestRating: 1500,
          lowestRating: 1500,
          totalMatches: 0,
        },
      });
    }
    return this.playerGamificationData.get(playerId)!;
  }

  /**
   * Attribue un badge à un joueur
   */
  awardBadge(playerId: string, badgeId: string, stackCount: number = 1): PlayerBadge | null {
    const player = this.getPlayer(playerId);
    if (!player) return null;

    const badge = this.badgeRegistry.get(badgeId);
    if (!badge) return null;

    const data = this.getOrCreateGamificationData(playerId);
    
    // Vérifier si le badge peut être stacké
    if (!badge.canStack()) {
      // Vérifier si le joueur a déjà ce badge
      const existingIndex = data.badges.findIndex(b => b.badgeId === badgeId);
      if (existingIndex !== -1) {
        // Badge déjà possédé et non stackable
        return null;
      }
    } else {
      // Vérifier le max de stacks
      const maxStacks = badge.getMaxStacks();
      const existing = data.badges.find(b => b.badgeId === badgeId);
      if (existing && maxStacks && existing.stackCount >= maxStacks) {
        // Max stacks atteint
        return null;
      }
      
      // Augmenter le stack existant
      if (existing) {
        existing.stackCount = Math.min(existing.stackCount + stackCount, maxStacks || Infinity);
        return existing;
      }
    }

    // Créer une nouvelle instance
    const playerBadge = badge.createInstance(stackCount);
    data.badges.push(playerBadge);
    
    return playerBadge;
  }

  /**
   * Retire un badge d'un joueur
   */
  removeBadge(playerId: string, badgeId: string): boolean {
    const data = this.getOrCreateGamificationData(playerId);
    const index = data.badges.findIndex(b => b.badgeId === badgeId);
    if (index !== -1) {
      data.badges.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Récupère les badges d'un joueur
   */
  getPlayerBadges(playerId: string): Array<{ badge: Badge; instance: PlayerBadge }> {
    const data = this.getOrCreateGamificationData(playerId);
    return data.badges
      .map(pb => {
        const badge = this.badgeRegistry.get(pb.badgeId);
        return badge ? { badge, instance: pb } : null;
      })
      .filter((item): item is { badge: Badge; instance: PlayerBadge } => item !== null);
  }

  /**
   * Récupère les statistiques d'un joueur
   */
  getPlayerStats(playerId: string) {
    const data = this.getOrCreateGamificationData(playerId);
    return { ...data.stats };
  }

  /**
   * Récupère les données XP d'un joueur
   */
  getPlayerXP(playerId: string): XPSystem {
    const data = this.getOrCreateGamificationData(playerId);
    return { ...data.xp };
  }

  /**
   * Crée le contexte de match pour évaluer les badges
   */
  private createMatchContext(
    player: Player,
    opponent: Player,
    result: MatchResult,
    originalRating: number,
    newRating: number
  ): MatchContext {
    const data = this.getOrCreateGamificationData(player.id);
    const expectedScore = Glicko2Calculator.predictWinProbability(player, opponent);
    
    return {
      player,
      opponent,
      result,
      expectedScore,
      ratingChange: newRating - originalRating,
      isUnderdog: player.rating < opponent.rating,
      winStreak: data.stats.winStreak,
      totalMatches: data.stats.totalMatches,
      consecutiveLosses: data.stats.consecutiveLosses,
    };
  }

  /**
   * Calcule les effets de tous les badges actifs
   */
  private calculateBadgeEffects(
    context: MatchContext,
    playerId: string
  ): { effects: BadgeEffect[]; sources: Array<{ badgeId: string; badgeName: string; effect: BadgeEffect }> } {
    const playerBadges = this.getPlayerBadges(playerId);
    const allEffects: BadgeEffect[] = [];
    const sources: Array<{ badgeId: string; badgeName: string; effect: BadgeEffect }> = [];

    for (const { badge, instance } of playerBadges) {
      const effects = badge.calculateEffects(context, instance);
      for (const effect of effects) {
        allEffects.push(effect);
        sources.push({
          badgeId: badge.config.id,
          badgeName: badge.config.name,
          effect,
        });
      }

      // Décrémenter les utilisations restantes si applicable
      if (instance.remainingUses !== undefined && effects.length > 0) {
        instance.remainingUses--;
      }
    }

    return { effects: allEffects, sources };
  }

  /**
   * Applique les effets des badges aux résultats de rating
   */
  private applyBadgeEffects(
    originalResult: RatingUpdate,
    effects: BadgeEffect[],
    context: MatchContext
  ): RatingUpdate {
    let modifiedResult = { ...originalResult };

    for (const effect of effects) {
      switch (effect.type) {
        case "rating_multiplier": {
          // Multiplie le changement de rating
          const change = modifiedResult.rating - context.player.rating;
          const isGain = change > 0;
          
          if (isGain) {
            // Augmenter les gains
            modifiedResult.rating = context.player.rating + (change * effect.value);
          }
          // Ne pas affecter les pertes avec ce multiplicateur
          break;
        }

        case "loss_protection": {
          // Réduit les pertes
          const change = modifiedResult.rating - context.player.rating;
          if (change < 0) {
            // Réduire la perte (effect.value est le multiplicateur, ex: 0.5 = -50%)
            modifiedResult.rating = context.player.rating + (change * effect.value);
          }
          break;
        }

        case "consolation": {
          // Bonus après une série de défaites
          const change = modifiedResult.rating - context.player.rating;
          if (change > 0) {
            // Augmenter les gains avec consolation
            modifiedResult.rating = context.player.rating + (change * effect.value);
          }
          break;
        }

        case "rd_boost": {
          // Réduit la déviation plus vite (valeur < 1)
          const originalRd = modifiedResult.rd;
          const targetRd = originalRd * effect.value;
          modifiedResult.rd = targetRd;
          break;
        }

        case "volatility_reduction": {
          // Réduit la volatilité (valeur < 1)
          modifiedResult.volatility = modifiedResult.volatility * effect.value;
          break;
        }

        case "experience_boost": {
          // Géré séparément dans le système XP
          break;
        }
      }
    }

    return modifiedResult;
  }

  /**
   * Calcule l'XP gagnée pour un match
   */
  private calculateXPGain(context: MatchContext): number {
    let xp = 10; // XP de base

    // Bonus selon le résultat
    if (context.result === 1) xp += 20;      // Victoire
    else if (context.result === 0.5) xp += 10; // Match nul
    else xp += 5;                           // Défaite (participation)

    // Bonus de difficulté (outsider)
    if (context.isUnderdog && context.result === 1) {
      const ratingDiff = context.opponent.rating - context.player.rating;
      xp += Math.min(Math.floor(ratingDiff / 50), 50); // Max +50 XP
    }

    // Bonus de série
    if (context.winStreak > 0) {
      xp += context.winStreak * 5; // +5 XP par victoire consécutive
    }

    return xp;
  }

  /**
   * Met à jour les statistiques après un match
   */
  private updateStats(playerId: string, result: MatchResult, ratingBefore: number, ratingAfter: number): void {
    const data = this.getOrCreateGamificationData(playerId);
    const stats = data.stats;

    stats.totalMatches++;
    
    if (result === 1) {
      stats.wins++;
      stats.winStreak++;
      stats.consecutiveLosses = 0;
    } else if (result === 0) {
      stats.losses++;
      stats.winStreak = 0;
      stats.consecutiveLosses++;
    } else {
      stats.draws++;
      stats.winStreak = 0;
      stats.consecutiveLosses = 0;
    }

    // Mettre à jour les records
    stats.highestRating = Math.max(stats.highestRating, ratingAfter);
    stats.lowestRating = Math.min(stats.lowestRating, ratingAfter);

    // Ajouter à l'historique
    data.matchHistory.results.push({
      timestamp: new Date(),
      result,
      opponentRating: 0, // Sera mis à jour par l'appelant
      ratingBefore,
      ratingAfter,
    });
  }

  /**
   * Ajoute de l'XP à un joueur et gère les niveaux
   */
  private addXP(playerId: string, amount: number): { leveledUp: boolean; newLevel?: number } {
    const data = this.getOrCreateGamificationData(playerId);
    const xp = data.xp;

    xp.currentXP += amount;
    xp.totalXP += amount;

    let leveledUp = false;
    let newLevel = xp.level;

    // Vérifier les montées de niveau
    while (xp.currentXP >= xp.nextLevelThreshold) {
      xp.currentXP -= xp.nextLevelThreshold;
      xp.level++;
      leveledUp = true;
      newLevel = xp.level;
      // Augmenter le seuil pour le prochain niveau (progression exponentielle)
      xp.nextLevelThreshold = Math.floor(xp.nextLevelThreshold * 1.2);
    }

    return { leveledUp, newLevel };
  }

  /**
   * Redéfinit updateRatings pour intégrer la gamification
   */
  override updateRatings(): Player[] {
    // Récupérer les matchs en attente via une méthode interne
    // Note: Nous devons accéder aux matchs en attente, mais ils sont privés dans Glicko2
    // Nous allons utiliser une approche différente

    // Pour chaque match en attente, calculer avec les effets de badges
    // Cette méthode nécessite d'accéder aux matchs en attente
    
    // Appelons d'abord la méthode parent pour traiter les matchs normalement
    // puis appliquons les modifications

    // NOTE: Comme les matchs en attente sont privés dans Glicko2,
    // nous devons surcharger recordMatch pour stocker les matchs localement
    
    return super.updateRatings();
  }

  /**
   * Calcule le nouveau rating d'un joueur avec effets de badges
   * Cette méthode peut être appelée manuellement pour un calcul personnalisé
   */
  calculateRatingWithBadges(
    player: Player,
    matches: MatchOutcome[]
  ): ModifiedRatingResult {
    // Capturer les valeurs AVANT toute modification
    const originalRating = player.rating;
    const originalRd = player.rd;
    const originalVolatility = player.volatility;
    
    const calculator = new Glicko2Calculator();
    const glickoResult = calculator.calculateNewRating(player, matches);
    
    let finalResult = { ...glickoResult };
    const allEffects: Array<{ badgeId: string; badgeName: string; effect: BadgeEffect; value: number }> = [];
    let totalXP = 0;
    const bonusReasons: string[] = [];

    // Appliquer les effets pour chaque match
    for (const match of matches) {
      const context = this.createMatchContext(
        player,
        match.opponent,
        match.result,
        originalRating,
        glickoResult.rating
      );

      const { effects, sources } = this.calculateBadgeEffects(context, player.id);
      
      // Calculer l'XP pour ce match
      const xpGain = this.calculateXPGain(context);
      totalXP += xpGain;

      // Appliquer les effets
      if (effects.length > 0) {
        finalResult = this.applyBadgeEffects(finalResult, effects, context);
        
        // Collecter les sources
        for (const source of sources) {
          allEffects.push({
            badgeId: source.badgeId,
            badgeName: source.badgeName,
            effect: source.effect,
            value: source.effect.value,
          });
          bonusReasons.push(`${source.badgeName}: ${source.effect.description}`);
        }
      }

      // Mettre à jour les statistiques
      this.updateStats(player.id, match.result, player.rating, finalResult.rating);

      // Ajouter l'XP
      const levelUp = this.addXP(player.id, xpGain);
      if (levelUp.leveledUp) {
        bonusReasons.push(`🎉 Niveau ${levelUp.newLevel} atteint !`);
      }
    }

    // Mettre à jour le joueur avec les nouvelles valeurs
    player.updateGlicko2Values(
      (finalResult.rating - CONSTANTS.DEFAULT_RATING) / CONSTANTS.SCALE,
      finalResult.rd / CONSTANTS.SCALE,
      finalResult.volatility
    );

    return {
      originalRating,
      modifiedRating: finalResult.rating,
      originalRd,
      modifiedRd: finalResult.rd,
      originalVolatility,
      modifiedVolatility: finalResult.volatility,
      appliedEffects: allEffects,
      xpGained: totalXP,
      bonusReasons,
    };
  }

  /**
   * Récupère le registre de badges (pour ajouter des badges personnalisés)
   */
  getBadgeRegistry(): BadgeRegistry {
    return this.badgeRegistry;
  }

  /**
   * Réinitialise les données de gamification d'un joueur
   */
  resetPlayerGamification(playerId: string): void {
    this.playerGamificationData.delete(playerId);
  }

  /**
   * Exporte les données de gamification
   */
  exportGamificationData(): Record<string, GamifiedPlayerData> {
    return Object.fromEntries(this.playerGamificationData);
  }

  /**
   * Importe les données de gamification
   */
  importGamificationData(data: Record<string, GamifiedPlayerData>): void {
    this.playerGamificationData = new Map(Object.entries(data));
  }
}

// Ré-exports pour faciliter l'utilisation
export { Badge, BadgeRegistry, BadgeEffects } from "./badge.ts";
export type { 
  BadgeConfig, 
  BadgeCondition, 
  BadgeEffect, 
  MatchContext,
  PlayerBadge,
  ModifiedRatingResult,
  XPSystem,
  PlayerMatchHistory 
} from "./types.ts";

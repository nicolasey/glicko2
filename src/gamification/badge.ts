import type { 
  BadgeConfig, 
  BadgeCondition, 
  BadgeEffect, 
  MatchContext,
  PlayerBadge,
  BadgeEffectType 
} from "./types.ts";

/**
 * Représente un badge dans le système de gamification
 */
export class Badge {
  readonly config: BadgeConfig;

  constructor(config: BadgeConfig) {
    this.config = config;
  }

  /**
   * Vérifie si les conditions du badge sont remplies dans le contexte donné
   */
  isActive(context: MatchContext): boolean {
    return this.config.conditions.every(condition => 
      this.checkCondition(condition, context)
    );
  }

  /**
   * Vérifie une condition spécifique
   */
  private checkCondition(condition: BadgeCondition, context: MatchContext): boolean {
    switch (condition.type) {
      case "always":
        return true;
      
      case "win":
        return context.result === 1;
      
      case "loss":
        return context.result === 0;
      
      case "draw":
        return context.result === 0.5;
      
      case "underdog_win":
        return context.result === 1 && context.isUnderdog;
      
      case "win_streak_min":
        return context.winStreak >= condition.count;
      
      case "consecutive_losses_min":
        return context.consecutiveLosses >= condition.count;
      
      case "rating_above":
        return context.player.rating > condition.threshold;
      
      case "rating_below":
        return context.player.rating < condition.threshold;
      
      case "matches_played_min":
        return context.totalMatches >= condition.count;
      
      case "matches_played_max":
        return context.totalMatches <= condition.count;
      
      case "opponent_rating_above":
        return context.opponent.rating > condition.threshold;
      
      case "opponent_rating_below":
        return context.opponent.rating < condition.threshold;
      
      case "unexpected_result":
        // Victoire improbable (expectedScore < 0.3) ou défaite attendue (expectedScore > 0.7)
        return (context.result === 1 && context.expectedScore < 0.3) ||
               (context.result === 0 && context.expectedScore > 0.7);
      
      case "custom":
        return condition.check(context);
      
      default:
        return false;
    }
  }

  /**
   * Calcule les effets appliqués par ce badge
   */
  calculateEffects(context: MatchContext, playerBadge: PlayerBadge): BadgeEffect[] {
    if (!this.isActive(context)) {
      return [];
    }

    // Si le badge a des utilisations limitées
    if (playerBadge.remainingUses !== undefined && playerBadge.remainingUses <= 0) {
      return [];
    }

    // Multiplier les effets par le nombre de stacks
    return this.config.effects.map(effect => ({
      ...effect,
      value: effect.value * playerBadge.stackCount,
    }));
  }

  /**
   * Crée une instance de badge pour un joueur
   */
  createInstance(stackCount: number = 1): PlayerBadge {
    const now = new Date();
    return {
      badgeId: this.config.id,
      obtainedAt: now,
      expiresAt: this.config.duration 
        ? new Date(now.getTime() + this.config.duration * 86400000) // Convertir jours en ms
        : undefined,
      remainingUses: this.config.duration, // Si duration, considéré comme utilisations
      stackCount,
    };
  }

  /**
   * Vérifie si le badge peut être stacké
   */
  canStack(): boolean {
    return this.config.stackable;
  }

  /**
   * Retourne le nombre max de stacks
   */
  getMaxStacks(): number | undefined {
    return this.config.maxStacks;
  }

  toString(): string {
    return `[${this.config.rarity.toUpperCase()}] ${this.config.name}: ${this.config.description}`;
  }
}

/**
 * Registre global des badges disponibles
 */
export class BadgeRegistry {
  private badges: Map<string, Badge> = new Map();

  /**
   * Enregistre un nouveau badge
   */
  register(config: BadgeConfig): Badge {
    const badge = new Badge(config);
    this.badges.set(config.id, badge);
    return badge;
  }

  /**
   * Récupère un badge par son ID
   */
  get(id: string): Badge | undefined {
    return this.badges.get(id);
  }

  /**
   * Retourne tous les badges
   */
  getAll(): Badge[] {
    return Array.from(this.badges.values());
  }

  /**
   * Retourne les badges par rareté
   */
  getByRarity(rarity: BadgeConfig["rarity"]): Badge[] {
    return this.getAll().filter(b => b.config.rarity === rarity);
  }

  /**
   * Supprime un badge
   */
  unregister(id: string): boolean {
    return this.badges.delete(id);
  }

  /**
   * Crée les badges par défaut
   */
  static createDefaultBadges(): BadgeRegistry {
    const registry = new BadgeRegistry();

    // Badge: Débutant chanceux - Bonus pour les nouveaux joueurs
    registry.register({
      id: "lucky_beginner",
      name: "Débutant Chanceux",
      description: "Vos premiers matchs rapportent 50% de points bonus",
      icon: "🍀",
      rarity: "common",
      conditions: [{ type: "matches_played_max", count: 10 }],
      effects: [{
        type: "rating_multiplier",
        value: 1.5,
        description: "+50% de gains de rating",
      }],
      stackable: false,
    });

    // Badge: Série victorieuse - Bonus après 3 victoires consécutives
    registry.register({
      id: "win_streak",
      name: "Série Victorieuse",
      description: "Bonus de 20% après 3 victoires consécutives",
      icon: "🔥",
      rarity: "rare",
      conditions: [{ type: "win_streak_min", count: 3 }],
      effects: [{
        type: "rating_multiplier",
        value: 1.2,
        description: "+20% de gains de rating",
      }],
      duration: 1, // Dure 1 match
      stackable: true,
      maxStacks: 3,
    });

    // Badge: David vs Goliath - Bonus quand on bat un meilleur joueur
    registry.register({
      id: "david_goliath",
      name: "David vs Goliath",
      description: "Doublez vos gains quand vous battez un adversaire +200 points",
      icon: "⚔️",
      rarity: "epic",
      conditions: [
        { type: "win" },
        { type: "opponent_rating_above", threshold: 1700 },
        { type: "custom", check: (ctx) => ctx.opponent.rating - ctx.player.rating > 200 },
      ],
      effects: [{
        type: "rating_multiplier",
        value: 2.0,
        description: "x2 gains de rating",
      }],
      stackable: false,
    });

    // Badge: Protection débutant - Réduit les pertes
    registry.register({
      id: "beginner_shield",
      name: "Bouclier du Débutant",
      description: "Vos défaites perdent 50% moins de points (10 premiers matchs)",
      icon: "🛡️",
      rarity: "common",
      conditions: [
        { type: "loss" },
        { type: "matches_played_max", count: 10 },
      ],
      effects: [{
        type: "loss_protection",
        value: 0.5,
        description: "-50% de pertes de rating",
      }],
      stackable: false,
    });

    // Badge: Perseverance - Bonus après 3 défaites consécutives
    registry.register({
      id: "perseverance",
      name: "Persévérance",
      description: "Consolation: +30% sur votre prochaine victoire après 3 défaites",
      icon: "💪",
      rarity: "rare",
      conditions: [
        { type: "win" },
        { type: "consecutive_losses_min", count: 3 },
      ],
      effects: [{
        type: "consolation",
        value: 1.3,
        description: "+30% de gains (consolation)",
      }],
      stackable: false,
    });

    // Badge: Maitre confirmé - Bonus pour les hauts ratings
    registry.register({
      id: "confirmed_master",
      name: "Maître Confirmé",
      description: "Votre stabilité réduit votre volatilité",
      icon: "👑",
      rarity: "legendary",
      conditions: [
        { type: "rating_above", threshold: 2000 },
        { type: "matches_played_min", count: 50 },
      ],
      effects: [{
        type: "volatility_reduction",
        value: 0.8,
        description: "-20% de volatilité",
      }],
      stackable: false,
    });

    // Badge: Expert en rapidité - Réduction de la déviation
    registry.register({
      id: "quick_learner",
      name: "Apprentissage Rapide",
      description: "Votre déviation diminue 25% plus vite",
      icon: "⚡",
      rarity: "rare",
      conditions: [{ type: "always" }],
      effects: [{
        type: "rd_boost",
        value: 0.75,
        description: "-25% de réduction RD",
      }],
      stackable: false,
    });

    return registry;
  }
}

// Export des effets prédéfinis pour créer ses propres badges
export const BadgeEffects = {
  ratingMultiplier: (value: number, description?: string): BadgeEffect => ({
    type: "rating_multiplier",
    value,
    description: description || `x${value} gains de rating`,
  }),

  lossProtection: (value: number, description?: string): BadgeEffect => ({
    type: "loss_protection",
    value,
    description: description || `${Math.round((1 - value) * 100)}% de protection`,
  }),

  consolation: (value: number, description?: string): BadgeEffect => ({
    type: "consolation",
    value,
    description: description || `+${Math.round((value - 1) * 100)}% de consolation`,
  }),

  volatilityReduction: (value: number, description?: string): BadgeEffect => ({
    type: "volatility_reduction",
    value,
    description: description || `${Math.round((1 - value) * 100)}% de volatilité`,
  }),

  rdBoost: (value: number, description?: string): BadgeEffect => ({
    type: "rd_boost",
    value,
    description: description || `${Math.round((1 - value) * 100)}% de réduction RD`,
  }),
};

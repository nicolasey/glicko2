import { CONSTANTS, type Glicko2Config, type MatchResult, type RatingUpdate, DEFAULT_CONFIG } from "./types.ts";
import { Player } from "./player.ts";

/**
 * Résultat d'un match avec les informations de l'adversaire
 * Utilisé pour les calculs de mise à jour du rating
 */
export interface MatchOutcome {
  opponent: Player;
  result: MatchResult;
}

/**
 * Moteur de calcul Glicko-2
 * 
 * Implémente l'algorithme complet décrit dans :
 * "Example of the Calculations of the Glicko-2 System" par Mark E. Glickman
 */
export class Glicko2Calculator {
  private config: Glicko2Config;

  constructor(config: Partial<Glicko2Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calcule le nouveau rating d'un joueur après une série de matchs
   * 
   * @param player - Le joueur à mettre à jour
   * @param matches - Les matchs joués par le joueur dans cette période
   * @returns Le nouveau rating, rd et volatility
   */
  calculateNewRating(
    player: Player,
    matches: MatchOutcome[]
  ): RatingUpdate {
    // Si aucun match joué, on réduit simplement la déviation (incertitude augmente avec le temps)
    if (matches.length === 0) {
      const newPhi = this.phiStar(player.phi, player.volatility);
      return {
        rating: player.rating,
        rd: Math.min(newPhi * CONSTANTS.SCALE, CONSTANTS.DEFAULT_RD),
        volatility: player.volatility,
      };
    }

    // 1. Calcul de v (variance de la distribution prédictive)
    const v = this.calculateVariance(player, matches);

    // 2. Calcul de Δ (delta, amélioration du rating estimée)
    const delta = this.calculateDelta(player, matches, v);

    // 3. Mise à jour de la volatilité σ (itératif)
    const newSigma = this.calculateNewVolatility(player, v, delta);

    // 4. Mise à jour de φ (déviation)
    const phiStar = this.phiStar(player.phi, newSigma);
    const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);

    // 5. Mise à jour de μ (rating)
    let newMu = player.mu;
    for (const match of matches) {
      const g = this.g(match.opponent.phi);
      const E = this.E(player.mu, match.opponent.mu, match.opponent.phi);
      newMu += newPhi * newPhi * g * (match.result - E);
    }

    // Conversion vers l'échelle Glicko-1
    const newRating = CONSTANTS.DEFAULT_RATING + newMu * CONSTANTS.SCALE;
    const newRd = newPhi * CONSTANTS.SCALE;

    return {
      rating: newRating,
      rd: newRd,
      volatility: newSigma,
    };
  }

  /**
   * Calcule la variance v
   * v = [ Σ (g(φj)² * E(μ, μj, φj) * (1 - E(μ, μj, φj))) ]⁻¹
   */
  private calculateVariance(player: Player, matches: MatchOutcome[]): number {
    let sum = 0;
    for (const match of matches) {
      const g = this.g(match.opponent.phi);
      const E = this.E(player.mu, match.opponent.mu, match.opponent.phi);
      sum += g * g * E * (1 - E);
    }
    return 1 / sum;
  }

  /**
   * Calcule delta (Δ)
   * Δ = v * Σ (g(φj) * (s - E(μ, μj, φj)))
   */
  private calculateDelta(player: Player, matches: MatchOutcome[], v: number): number {
    let sum = 0;
    for (const match of matches) {
      const g = this.g(match.opponent.phi);
      const E = this.E(player.mu, match.opponent.mu, match.opponent.phi);
      sum += g * (match.result - E);
    }
    return v * sum;
  }

  /**
   * Calcule la nouvelle volatilité σ
   * Utilise une méthode itérative pour résoudre f(x) = 0
   */
  private calculateNewVolatility(player: Player, v: number, delta: number): number {
    const phi = player.phi;
    const sigma = player.volatility;
    
    // 1. Paramètres initiaux
    const a = Math.log(sigma * sigma);
    const tau = this.config.tau;
    
    // 2. Définition de la fonction f(x)
    const f = (x: number): number => {
      const ex = Math.exp(x);
      const phi2 = phi * phi;
      const delta2 = delta * delta;
      const numerator = ex * (delta2 - phi2 - v - ex);
      const denominator = 2 * Math.pow(phi2 + v + ex, 2);
      return (numerator / denominator) - ((x - a) / (tau * tau));
    };

    // 3. Recherche de la borne supérieure
    let A = a;
    let B: number;
    
    if (delta * delta > phi * phi + v) {
      B = Math.log(delta * delta - phi * phi - v);
    } else {
      let k = 1;
      while (f(a - k * tau) < 0) {
        k++;
      }
      B = a - k * tau;
    }

    // 4. Méthode de Newton-Raphson itérative
    let fA = f(A);
    let fB = f(B);
    
    // Vérification des signes
    while (fB > 0 && Math.abs(B - A) > this.config.epsilon) {
      const C = A + (A - B) * fA / (fB - fA);
      const fC = f(C);
      
      if (fC * fB < 0) {
        A = B;
        fA = fB;
      } else {
        fA = fA / 2;
      }
      
      B = C;
      fB = fC;
    }

    // Valeur convergée
    return Math.exp(B / 2);
  }

  /**
   * Calcule φ* (déviation avec volatilité augmentée)
   * φ* = √(φ² + σ²)
   */
  private phiStar(phi: number, sigma: number): number {
    return Math.sqrt(phi * phi + sigma * sigma);
  }

  /**
   * Fonction g(φ)
   * g(φ) = 1 / √(1 + 3φ²/π²)
   */
  private g(phi: number): number {
    return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
  }

  /**
   * Fonction E(μ, μj, φj)
   * E(μ, μj, φj) = 1 / (1 + exp(-g(φj)(μ - μj)))
   */
  private E(mu: number, muJ: number, phiJ: number): number {
    return 1 / (1 + Math.exp(-this.g(phiJ) * (mu - muJ)));
  }

  /**
   * Calcule la probabilité de victoire entre deux joueurs
   * @returns Probabilité entre 0 et 1
   */
  static predictWinProbability(player1: Player, player2: Player): number {
    const calculator = new Glicko2Calculator();
    const g = calculator.g(player2.phi);
    return 1 / (1 + Math.exp(-g * (player1.mu - player2.mu)));
  }

  /**
   * Applique une augmentation de la déviation (phi) pour tenir compte
du temps écoulé depuis le dernier match
   * 
   * Cette méthode augmente l'incertitude sur le rating d'un joueur
   * qui n'a pas joué depuis longtemps
   * 
   * @param currentPhi - La déviation actuelle
   * @param sigma - La volatilité
   * @param ratingPeriods - Nombre de périodes de rating écoulées
   * @returns La nouvelle déviation augmentée
   */
  applyRatingPeriodDecay(currentPhi: number, sigma: number, ratingPeriods: number = 1): number {
    // La déviation augmente avec le temps : φ' = √(φ² + c·σ²)
    // où c est le nombre de périodes de rating écoulées
    return Math.sqrt(currentPhi * currentPhi + ratingPeriods * sigma * sigma);
  }
}

/**
 * Classe utilitaire pour créer des matchs
 */
export class Match {
  readonly player1Id: string;
  readonly player2Id: string;
  readonly result: MatchResult;
  readonly timestamp: Date;

  constructor(
    player1Id: string,
    player2Id: string,
    result: MatchResult,
    timestamp: Date = new Date()
  ) {
    this.player1Id = player1Id;
    this.player2Id = player2Id;
    this.result = result;
    this.timestamp = timestamp;
  }

  /**
   * Crée un match depuis un résultat textuel
   * @param player1Id - ID du joueur 1
   * @param player2Id - ID du joueur 2
   * @param winnerId - ID du gagnant (null pour match nul)
   * @param timestamp - Date du match
   */
  static fromWinner(
    player1Id: string,
    player2Id: string,
    winnerId: string | null,
    timestamp?: Date
  ): Match {
    let result: MatchResult;
    if (winnerId === null) {
      result = 0.5;
    } else if (winnerId === player1Id) {
      result = 1;
    } else {
      result = 0;
    }
    return new Match(player1Id, player2Id, result, timestamp);
  }

  /**
   * Inverse le résultat du match (point de vue du joueur 2)
   */
  reverse(): Match {
    return new Match(
      this.player2Id,
      this.player1Id,
      (1 - this.result) as MatchResult,
      this.timestamp
    );
  }
}

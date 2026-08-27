import { CONSTANTS, type Glicko2Config, type MatchResult, type RatingUpdate, DEFAULT_CONFIG } from "./types.ts";
import { Player } from "./player.ts";

/**
 * Match result along with the opponent's information
 * Used by the rating update computations
 */
export interface MatchOutcome {
  opponent: Player;
  result: MatchResult;
}

/**
 * Glicko-2 computation engine
 * 
 * Implements the full algorithm described in:
 * "Example of the Calculations of the Glicko-2 System" by Mark E. Glickman
 */
export class Glicko2Calculator {
  private config: Glicko2Config;

  constructor(config: Partial<Glicko2Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Computes a player's new rating after a series of matches
   * 
   * @param player - The player to update
   * @param matches - The matches played by the player during this period
   * @returns The new rating, rd and volatility
   */
  calculateNewRating(
    player: Player,
    matches: MatchOutcome[]
  ): RatingUpdate {
      // No match played: only widen the deviation (uncertainty grows over time)
    if (matches.length === 0) {
      const newPhi = this.phiStar(player.phi, player.volatility);
      return {
        rating: player.rating,
        rd: Math.min(newPhi * CONSTANTS.SCALE, CONSTANTS.DEFAULT_RD),
        volatility: player.volatility,
      };
    }

    // 1. Compute v (variance of the predictive distribution)
    const v = this.calculateVariance(player, matches);

    // 2. Compute Δ (delta, estimated rating improvement)
    const delta = this.calculateDelta(player, matches, v);

    // 3. Update the volatility σ (iterative)
    const newSigma = this.calculateNewVolatility(player, v, delta);

    // 4. Update φ (deviation)
    const phiStar = this.phiStar(player.phi, newSigma);
    const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);

    // 5. Update μ (rating)
    let newMu = player.mu;
    for (const match of matches) {
      const g = this.g(match.opponent.phi);
      const E = this.E(player.mu, match.opponent.mu, match.opponent.phi);
      newMu += newPhi * newPhi * g * (match.result - E);
    }

    // Conversion back to the Glicko-1 scale
    const newRating = CONSTANTS.DEFAULT_RATING + newMu * CONSTANTS.SCALE;
    const newRd = newPhi * CONSTANTS.SCALE;

    return {
      rating: newRating,
      rd: newRd,
      volatility: newSigma,
    };
  }

  /**
   * Computes the variance v
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
   * Computes delta (Δ)
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
   * Computes the new volatility σ
   * Uses an iterative method to solve f(x) = 0
   */
  private calculateNewVolatility(player: Player, v: number, delta: number): number {
    const phi = player.phi;
    const sigma = player.volatility;
    
    // 1. Initial parameters
    const a = Math.log(sigma * sigma);
    const tau = this.config.tau;
    
    // 2. Definition of the function f(x)
    const f = (x: number): number => {
      const ex = Math.exp(x);
      const phi2 = phi * phi;
      const delta2 = delta * delta;
      const numerator = ex * (delta2 - phi2 - v - ex);
      const denominator = 2 * Math.pow(phi2 + v + ex, 2);
      return (numerator / denominator) - ((x - a) / (tau * tau));
    };

    // 3. Search for the upper bound
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

    // 4. Iterative Newton-Raphson method
    let fA = f(A);
    let fB = f(B);
    
    // Sign check
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

    // Converged value
    return Math.exp(B / 2);
  }

  /**
   * Computes φ* (deviation with increased volatility)
   * φ* = √(φ² + σ²)
   */
  private phiStar(phi: number, sigma: number): number {
    return Math.sqrt(phi * phi + sigma * sigma);
  }

  /**
   * Function g(φ)
   * g(φ) = 1 / √(1 + 3φ²/π²)
   */
  private g(phi: number): number {
    return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
  }

  /**
   * Function E(μ, μj, φj)
   * E(μ, μj, φj) = 1 / (1 + exp(-g(φj)(μ - μj)))
   */
  private E(mu: number, muJ: number, phiJ: number): number {
    return 1 / (1 + Math.exp(-this.g(phiJ) * (mu - muJ)));
  }

  /**
   * Computes the win probability between two players
   * @returns Probability between 0 and 1
   */
  static predictWinProbability(player1: Player, player2: Player): number {
    const calculator = new Glicko2Calculator();
    const g = calculator.g(player2.phi);
    return 1 / (1 + Math.exp(-g * (player1.mu - player2.mu)));
  }

  /**
   * Increases the deviation (phi) to account for the time
   * elapsed since the player's last match
   * 
   * This widens the uncertainty about the rating of a player
   * who has not played for a long time
   * 
   * @param currentPhi - The current deviation
   * @param sigma - The volatility
   * @param ratingPeriods - Number of elapsed rating periods
   * @returns The new, widened deviation
   */
  applyRatingPeriodDecay(currentPhi: number, sigma: number, ratingPeriods: number = 1): number {
    // The deviation grows over time: φ' = √(φ² + c·σ²)
    // where c is the number of elapsed rating periods
    return Math.sqrt(currentPhi * currentPhi + ratingPeriods * sigma * sigma);
  }
}

/**
 * Utility class for creating matches
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
   * Creates a match from a winner
   * @param player1Id - ID of player 1
   * @param player2Id - ID of player 2
   * @param winnerId - ID of the winner (null for a draw)
   * @param timestamp - Date of the match
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
   * Reverses the match result (from player 2's point of view)
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

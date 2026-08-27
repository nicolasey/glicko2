import { CONSTANTS, type PlayerData, type MatchResult } from "./types.ts";

/**
 * Represents a player with their Glicko-2 rating
 * 
 * The Glicko-2 system uses three parameters:
 * - rating: the rating (1500 by default)
 * - rd (rating deviation): the uncertainty about the rating (350 by default)
 * - volatility: how much the rating fluctuates (0.06 by default)
 * 
 * Values are stored internally on the Glicko-2 scale (μ, φ) but exposed
 * on the Glicko-1 scale (rating, rd) for readability.
 */
export class Player {
  readonly id: string;
  
  // Glicko-2 scale values (internal)
  private _mu: number;      // μ - rating on the Glicko-2 scale
  private _phi: number;     // φ - deviation on the Glicko-2 scale
  private _sigma: number;   // σ - volatility
  
  // Glicko-1 scale values (for display)
  private _rating: number;
  private _rd: number;
  
  private _lastRatingPeriod: Date;

  constructor(
    id: string,
    rating: number = CONSTANTS.DEFAULT_RATING,
    rd: number = CONSTANTS.DEFAULT_RD,
    volatility: number = CONSTANTS.DEFAULT_VOLATILITY,
    lastRatingPeriod?: Date
  ) {
    this.id = id;
    this._rating = rating;
    this._rd = rd;
    this._sigma = volatility;
    this._lastRatingPeriod = lastRatingPeriod ?? new Date();
    
    // Conversion to the Glicko-2 scale
    this._mu = (rating - CONSTANTS.DEFAULT_RATING) / CONSTANTS.SCALE;
    this._phi = rd / CONSTANTS.SCALE;
  }

  /** Creates a player from serialized data */
  static fromData(data: PlayerData): Player {
    return new Player(
      data.id,
      data.rating,
      data.rd,
      data.volatility,
      data.lastRatingPeriod
    );
  }

  /** Rating on the Glicko-1 scale (display) */
  get rating(): number {
    return this._rating;
  }

  /** Rating deviation on the Glicko-1 scale */
  get rd(): number {
    return this._rd;
  }

  /** Volatility σ */
  get volatility(): number {
    return this._sigma;
  }

  /** Rating μ on the Glicko-2 scale (internal) */
  get mu(): number {
    return this._mu;
  }

  /** Deviation φ on the Glicko-2 scale (internal) */
  get phi(): number {
    return this._phi;
  }

  /** Last rating period */
  get lastRatingPeriod(): Date {
    return this._lastRatingPeriod;
  }

  /** Updates the last rating period */
  setLastRatingPeriod(date: Date): void {
    this._lastRatingPeriod = date;
  }

  /**
   * Computes the win probability against another player
   * @param opponent - The opponent
   * @returns Win probability between 0 and 1
   */
  expectedScore(opponent: Player): number {
    return 1 / (1 + Math.exp(-this.g(opponent.phi) * (this._mu - opponent.mu)));
  }

  /**
   * Updates the internal values (Glicko-2 scale)
   * and recomputes the display values (Glicko-1 scale)
   */
  updateGlicko2Values(mu: number, phi: number, sigma: number): void {
    this._mu = mu;
    this._phi = phi;
    this._sigma = sigma;
    
    // Conversion to the Glicko-1 scale
    this._rating = CONSTANTS.DEFAULT_RATING + this._mu * CONSTANTS.SCALE;
    this._rd = this._phi * CONSTANTS.SCALE;
  }

  /** g(φ) function used in the computations */
  private g(phi: number): number {
    return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
  }

  /** Serializes the player to raw data */
  toData(): PlayerData {
    return {
      id: this.id,
      rating: this._rating,
      rd: this._rd,
      volatility: this._sigma,
      lastRatingPeriod: this._lastRatingPeriod,
    };
  }

  /** Returns a readable representation of the player */
  toString(): string {
    return `Player(${this.id}): rating=${this._rating.toFixed(2)}, rd=${this._rd.toFixed(2)}, σ=${this._sigma.toFixed(6)}`;
  }
}

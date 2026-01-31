import { CONSTANTS, type PlayerData, type MatchResult } from "./types.ts";

/**
 * Représente un joueur avec son classement Glicko-2
 * 
 * Le système Glicko-2 utilise trois paramètres :
 * - rating : le classement (1500 par défaut)
 * - rd (rating deviation) : l'incertitude sur le classement (350 par défaut)
 * - volatility : la volatilité du classement (0.06 par défaut)
 * 
 * Les valeurs sont stockées en interne à l'échelle Glicko-2 (μ, φ) mais
 * exposées à l'échelle Glicko-1 (rating, rd) pour plus de lisibilité.
 */
export class Player {
  readonly id: string;
  
  // Valeurs à l'échelle Glicko-2 (internes)
  private _mu: number;      // μ - rating à l'échelle Glicko-2
  private _phi: number;     // φ - déviation à l'échelle Glicko-2
  private _sigma: number;   // σ - volatilité
  
  // Valeurs à l'échelle Glicko-1 (pour affichage)
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
    
    // Conversion vers l'échelle Glicko-2
    this._mu = (rating - CONSTANTS.DEFAULT_RATING) / CONSTANTS.SCALE;
    this._phi = rd / CONSTANTS.SCALE;
  }

  /** Crée un joueur à partir de données sérialisées */
  static fromData(data: PlayerData): Player {
    return new Player(
      data.id,
      data.rating,
      data.rd,
      data.volatility,
      data.lastRatingPeriod
    );
  }

  /** Rating à l'échelle Glicko-1 (affichage) */
  get rating(): number {
    return this._rating;
  }

  /** Déviation du rating à l'échelle Glicko-1 */
  get rd(): number {
    return this._rd;
  }

  /** Volatilité σ */
  get volatility(): number {
    return this._sigma;
  }

  /** Rating μ à l'échelle Glicko-2 (interne) */
  get mu(): number {
    return this._mu;
  }

  /** Déviation φ à l'échelle Glicko-2 (interne) */
  get phi(): number {
    return this._phi;
  }

  /** Dernière période de rating */
  get lastRatingPeriod(): Date {
    return this._lastRatingPeriod;
  }

  /** Met à jour la dernière période de rating */
  setLastRatingPeriod(date: Date): void {
    this._lastRatingPeriod = date;
  }

  /**
   * Calcule la probabilité de victoire contre un autre joueur
   * @param opponent - L'adversaire
   * @returns Probabilité de victoire entre 0 et 1
   */
  expectedScore(opponent: Player): number {
    return 1 / (1 + Math.exp(-this.g(opponent.phi) * (this._mu - opponent.mu)));
  }

  /**
   * Met à jour les valeurs internes (échelle Glicko-2)
   * et recalcule les valeurs d'affichage (échelle Glicko-1)
   */
  updateGlicko2Values(mu: number, phi: number, sigma: number): void {
    this._mu = mu;
    this._phi = phi;
    this._sigma = sigma;
    
    // Conversion vers l'échelle Glicko-1
    this._rating = CONSTANTS.DEFAULT_RATING + this._mu * CONSTANTS.SCALE;
    this._rd = this._phi * CONSTANTS.SCALE;
  }

  /** Fonction g(φ) utilisée dans les calculs */
  private g(phi: number): number {
    return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
  }

  /** Sérialise le joueur en données brutes */
  toData(): PlayerData {
    return {
      id: this.id,
      rating: this._rating,
      rd: this._rd,
      volatility: this._sigma,
      lastRatingPeriod: this._lastRatingPeriod,
    };
  }

  /** Retourne une représentation lisible du joueur */
  toString(): string {
    return `Player(${this.id}): rating=${this._rating.toFixed(2)}, rd=${this._rd.toFixed(2)}, σ=${this._sigma.toFixed(6)}`;
  }
}

import { CONSTANTS, DEFAULT_CONFIG, type Glicko2Config, type PartialConfig, type MatchResult, type PlayerData } from "./types.ts";
import { Player } from "./player.ts";
import { Glicko2Calculator, Match, type MatchOutcome } from "./calculator.ts";

/**
 * Glicko-2 rating system
 * 
 * This main class handles the whole rating system:
 * - Creating and managing players
 * - Recording matches
 * - Computing new ratings per period
 * - Predicting results
 */
export class Glicko2 {
  private players: Map<string, Player> = new Map();
  private pendingMatches: Match[] = [];
  private config: Glicko2Config;
  private calculator: Glicko2Calculator;

  /**
   * Creates a new instance of the Glicko-2 system
   * @param config - Optional configuration
   */
  constructor(config: PartialConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.calculator = new Glicko2Calculator(this.config);
  }

  /**
   * Creates a new player in the system
   * @param id - Unique player identifier
   * @param rating - Initial rating (optional)
   * @param rd - Initial deviation (optional)
   * @param volatility - Initial volatility (optional)
   * @returns The created player
   */
  createPlayer(
    id: string,
    rating?: number,
    rd?: number,
    volatility?: number
  ): Player {
    if (this.players.has(id)) {
      throw new Error(`Player with ID ${id} already exists`);
    }

    const player = new Player(
      id,
      rating ?? this.config.defaultRating,
      rd ?? this.config.defaultRd,
      volatility ?? this.config.defaultVolatility
    );
    
    this.players.set(id, player);
    return player;
  }

  /**
   * Retrieves a player by ID
   * @param id - Player ID
   * @returns The player, or undefined if it does not exist
   */
  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  /**
   * Removes a player from the system
   * @param id - ID of the player to remove
   * @returns true if the player was removed
   */
  removePlayer(id: string): boolean {
    return this.players.delete(id);
  }

  /**
   * Returns every player
   */
  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  /**
   * Records a match between two players
   * @param player1Id - ID of player 1
   * @param player2Id - ID of player 2
   * @param result - Match result (1 = P1 wins, 0 = P2 wins, 0.5 = draw)
   * @param timestamp - Date of the match
   */
  recordMatch(
    player1Id: string,
    player2Id: string,
    result: MatchResult,
    timestamp?: Date
  ): void {
    const match = new Match(player1Id, player2Id, result, timestamp);
    this.pendingMatches.push(match);
  }

  /**
   * Records a match from its winner
   * @param player1Id - ID of player 1
   * @param player2Id - ID of player 2
   * @param winnerId - ID of the winner (null for a draw)
   * @param timestamp - Date of the match
   */
  recordMatchWithWinner(
    player1Id: string,
    player2Id: string,
    winnerId: string | null,
    timestamp?: Date
  ): void {
    const match = Match.fromWinner(player1Id, player2Id, winnerId, timestamp);
    this.pendingMatches.push(match);
  }

  /**
   * Computes the new ratings for every player who played
   * during the current rating period
   * @returns The updated players
   */
  updateRatings(): Player[] {
    if (this.pendingMatches.length === 0) {
      return [];
    }

    // Group the matches by player
    const matchesByPlayer = new Map<string, Match[]>();
    
    for (const match of this.pendingMatches) {
      // Match for player 1
      const p1Matches = matchesByPlayer.get(match.player1Id) ?? [];
      p1Matches.push(match);
      matchesByPlayer.set(match.player1Id, p1Matches);
      
      // Match for player 2 (reversed)
      const p2Matches = matchesByPlayer.get(match.player2Id) ?? [];
      p2Matches.push(match.reverse());
      matchesByPlayer.set(match.player2Id, p2Matches);
    }

    const updatedPlayers: Player[] = [];
    const now = new Date();

    // Compute the new ratings for each player who played
    for (const [playerId, matches] of matchesByPlayer) {
      const player = this.players.get(playerId);
      if (!player) continue;

      // Convert the matches into MatchOutcome
      const outcomes: MatchOutcome[] = matches.map(match => {
        const opponent = this.players.get(
          match.player1Id === playerId ? match.player2Id : match.player1Id
        );
        if (!opponent) {
          throw new Error(`Opponent not found for the match`);
        }
        
        // For a reversed match, the result is reversed too
        const result: MatchResult = match.player1Id === playerId 
          ? match.result 
          : (1 - match.result) as MatchResult;
        
        return {
          opponent,
          result,
        };
      });

      // Compute the new rating
      const newRating = this.calculator.calculateNewRating(player, outcomes);

      const prev = { rating: player.rating, rd: player.rd, volatility: player.volatility };

      // Apply the changes
      player.updateGlicko2Values(
        (newRating.rating - CONSTANTS.DEFAULT_RATING) / CONSTANTS.SCALE,
        newRating.rd / CONSTANTS.SCALE,
        newRating.volatility
      );
      player.setLastRatingPeriod(now);

      this.config.onRatingUpdate?.(playerId, prev, { rating: player.rating, rd: player.rd, volatility: player.volatility });

      updatedPlayers.push(player);
    }

    // Flush the processed matches
    this.pendingMatches = [];

    return updatedPlayers;
  }

  /**
   * Widens the deviation of inactive players
   * Call this at the end of every rating period
   * @param currentDate - Current date
   */
  applyDecay(currentDate: Date = new Date()): Player[] {
    const updatedPlayers: Player[] = [];
    const ratingPeriodMs = this.config.ratingPeriod * 1000;

    for (const player of this.players.values()) {
      const timeSinceLastMatch = currentDate.getTime() - player.lastRatingPeriod.getTime();
      const periods = Math.floor(timeSinceLastMatch / ratingPeriodMs);

      if (periods > 0) {
        // Widen the deviation caused by inactivity
        const currentPhi = player.phi;
        const newPhi = this.calculator.applyRatingPeriodDecay(
          currentPhi,
          player.volatility,
          periods
        );
        
        player.updateGlicko2Values(
          player.mu,
          newPhi,
          player.volatility
        );
        player.setLastRatingPeriod(currentDate);
        
        updatedPlayers.push(player);
      }
    }

    return updatedPlayers;
  }

  /**
   * Predicts the win probability between two players
   * @param player1Id - ID of player 1
   * @param player2Id - ID of player 2
   * @returns Win probability of player 1
   */
  predict(player1Id: string, player2Id: string): number {
    const p1 = this.players.get(player1Id);
    const p2 = this.players.get(player2Id);

    if (!p1 || !p2) {
      throw new Error("One or more players do not exist");
    }

    return Glicko2Calculator.predictWinProbability(p1, p2);
  }

  /**
   * Returns the players ranked by rating
   * @param descending - true for descending order (best first)
   */
  getLeaderboard(descending: boolean = true): Player[] {
    const players = this.getAllPlayers();
    return players.sort((a, b) => 
      descending ? b.rating - a.rating : a.rating - b.rating
    );
  }

  /**
   * Returns the leaderboard with 95% confidence intervals
   */
  getLeaderboardWithConfidence(): Array<{
    player: Player;
    lowerBound: number;
    upperBound: number;
  }> {
    return this.getLeaderboard().map(player => {
      // 95% confidence interval: rating ± 1.96 * rd
      const margin = 1.96 * player.rd;
      return {
        player,
        lowerBound: player.rating - margin,
        upperBound: player.rating + margin,
      };
    });
  }

  /**
   * Serializes the full state of the system
   */
  serialize(): {
    players: PlayerData[];
    pendingMatches: Array<{
      player1Id: string;
      player2Id: string;
      result: MatchResult;
      timestamp: string;
    }>;
    config: Glicko2Config;
  } {
    return {
      players: Array.from(this.players.values()).map(p => p.toData()),
      pendingMatches: this.pendingMatches.map(m => ({
        player1Id: m.player1Id,
        player2Id: m.player2Id,
        result: m.result,
        timestamp: m.timestamp.toISOString(),
      })),
      config: this.config,
    };
  }

  /**
   * Loads a serialized state
   */
  static deserialize(data: ReturnType<Glicko2["serialize"]>): Glicko2 {
    const glicko2 = new Glicko2(data.config);
    
    for (const playerData of data.players) {
      const player = Player.fromData(playerData);
      glicko2.players.set(player.id, player);
    }

    for (const matchData of data.pendingMatches) {
      const match = new Match(
        matchData.player1Id,
        matchData.player2Id,
        matchData.result,
        new Date(matchData.timestamp)
      );
      glicko2.pendingMatches.push(match);
    }

    return glicko2;
  }

  /**
   * Clears the pending matches without processing them
   */
  clearPendingMatches(): void {
    this.pendingMatches = [];
  }

  /**
   * Returns the number of pending matches
   */
  getPendingMatchesCount(): number {
    return this.pendingMatches.length;
  }
}

// Re-export for convenience
export { Player, Match, Glicko2Calculator, CONSTANTS, DEFAULT_CONFIG };
export type {
  Glicko2Config,
  PartialConfig,
  MatchResult,
  PlayerData,
  MatchOutcome,
  PlayerSnapshot,
} from "./types.ts";

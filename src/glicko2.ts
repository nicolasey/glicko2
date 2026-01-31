import { CONSTANTS, DEFAULT_CONFIG, type Glicko2Config, type PartialConfig, type MatchResult, type PlayerData } from "./types.ts";
import { Player } from "./player.ts";
import { Glicko2Calculator, Match, type MatchOutcome } from "./calculator.ts";

/**
 * Système de classement Glicko-2
 * 
 * Cette classe principale gère l'ensemble du système de classement :
 * - Création et gestion des joueurs
 * - Enregistrement des matchs
 * - Calcul des nouveaux ratings par période
 * - Prédiction des résultats
 */
export class Glicko2 {
  private players: Map<string, Player> = new Map();
  private pendingMatches: Match[] = [];
  private config: Glicko2Config;
  private calculator: Glicko2Calculator;

  /**
   * Crée une nouvelle instance du système Glicko-2
   * @param config - Configuration optionnelle
   */
  constructor(config: PartialConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.calculator = new Glicko2Calculator(this.config);
  }

  /**
   * Crée un nouveau joueur dans le système
   * @param id - Identifiant unique du joueur
   * @param rating - Rating initial (optionnel)
   * @param rd - Déviation initiale (optionnel)
   * @param volatility - Volatilité initiale (optionnel)
   * @returns Le joueur créé
   */
  createPlayer(
    id: string,
    rating?: number,
    rd?: number,
    volatility?: number
  ): Player {
    if (this.players.has(id)) {
      throw new Error(`Le joueur avec l'ID ${id} existe déjà`);
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
   * Récupère un joueur par son ID
   * @param id - ID du joueur
   * @returns Le joueur ou undefined s'il n'existe pas
   */
  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  /**
   * Supprime un joueur du système
   * @param id - ID du joueur à supprimer
   * @returns true si le joueur a été supprimé
   */
  removePlayer(id: string): boolean {
    return this.players.delete(id);
  }

  /**
   * Retourne tous les joueurs
   */
  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  /**
   * Enregistre un match entre deux joueurs
   * @param player1Id - ID du joueur 1
   * @param player2Id - ID du joueur 2
   * @param result - Résultat du match (1 = victoire P1, 0 = victoire P2, 0.5 = nul)
   * @param timestamp - Date du match
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
   * Enregistre un match depuis un gagnant
   * @param player1Id - ID du joueur 1
   * @param player2Id - ID du joueur 2
   * @param winnerId - ID du gagnant (null pour match nul)
   * @param timestamp - Date du match
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
   * Calcule les nouveaux ratings pour tous les joueurs ayant joué
   * pendant la période de rating courante
   * @returns Les joueurs mis à jour
   */
  updateRatings(): Player[] {
    if (this.pendingMatches.length === 0) {
      return [];
    }

    // Regrouper les matchs par joueur
    const matchesByPlayer = new Map<string, Match[]>();
    
    for (const match of this.pendingMatches) {
      // Match pour joueur 1
      const p1Matches = matchesByPlayer.get(match.player1Id) ?? [];
      p1Matches.push(match);
      matchesByPlayer.set(match.player1Id, p1Matches);
      
      // Match pour joueur 2 (inverse)
      const p2Matches = matchesByPlayer.get(match.player2Id) ?? [];
      p2Matches.push(match.reverse());
      matchesByPlayer.set(match.player2Id, p2Matches);
    }

    const updatedPlayers: Player[] = [];
    const now = new Date();

    // Calculer les nouveaux ratings pour chaque joueur ayant joué
    for (const [playerId, matches] of matchesByPlayer) {
      const player = this.players.get(playerId);
      if (!player) continue;

      // Convertir les matchs en MatchOutcome
      const outcomes: MatchOutcome[] = matches.map(match => {
        const opponent = this.players.get(
          match.player1Id === playerId ? match.player2Id : match.player1Id
        );
        if (!opponent) {
          throw new Error(`Adversaire non trouvé pour le match`);
        }
        
        // Si c'est le match inversé, on inverse aussi le résultat
        const result: MatchResult = match.player1Id === playerId 
          ? match.result 
          : (1 - match.result) as MatchResult;
        
        return {
          opponent,
          result,
        };
      });

      // Calculer le nouveau rating
      const newRating = this.calculator.calculateNewRating(player, outcomes);
      
      // Appliquer les changements
      player.updateGlicko2Values(
        (newRating.rating - CONSTANTS.DEFAULT_RATING) / CONSTANTS.SCALE,
        newRating.rd / CONSTANTS.SCALE,
        newRating.volatility
      );
      player.setLastRatingPeriod(now);
      
      updatedPlayers.push(player);
    }

    // Vider les matchs traités
    this.pendingMatches = [];

    return updatedPlayers;
  }

  /**
   * Applique la décroissance de la déviation pour les joueurs inactifs
   * Cette méthode doit être appelée à la fin de chaque période de rating
   * @param currentDate - Date actuelle
   */
  applyDecay(currentDate: Date = new Date()): Player[] {
    const updatedPlayers: Player[] = [];
    const ratingPeriodMs = this.config.ratingPeriod * 1000;

    for (const player of this.players.values()) {
      const timeSinceLastMatch = currentDate.getTime() - player.lastRatingPeriod.getTime();
      const periods = Math.floor(timeSinceLastMatch / ratingPeriodMs);

      if (periods > 0) {
        // Augmenter la déviation due à l'inactivité
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
   * Prédit la probabilité de victoire entre deux joueurs
   * @param player1Id - ID du joueur 1
   * @param player2Id - ID du joueur 2
   * @returns Probabilité de victoire du joueur 1
   */
  predict(player1Id: string, player2Id: string): number {
    const p1 = this.players.get(player1Id);
    const p2 = this.players.get(player2Id);

    if (!p1 || !p2) {
      throw new Error("Un ou plusieurs joueurs n'existent pas");
    }

    return Glicko2Calculator.predictWinProbability(p1, p2);
  }

  /**
   * Retourne le classement des joueurs par rating
   * @param descending - true pour ordre décroissant (meilleur en premier)
   */
  getLeaderboard(descending: boolean = true): Player[] {
    const players = this.getAllPlayers();
    return players.sort((a, b) => 
      descending ? b.rating - a.rating : a.rating - b.rating
    );
  }

  /**
   * Retourne le classement avec les intervalles de confiance à 95%
   */
  getLeaderboardWithConfidence(): Array<{
    player: Player;
    lowerBound: number;
    upperBound: number;
  }> {
    return this.getLeaderboard().map(player => {
      // Intervalle de confiance à 95% : rating ± 1.96 * rd
      const margin = 1.96 * player.rd;
      return {
        player,
        lowerBound: player.rating - margin,
        upperBound: player.rating + margin,
      };
    });
  }

  /**
   * Sérialise l'état complet du système
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
   * Charge un état sérialisé
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
   * Réinitialise les matchs en attente sans les traiter
   */
  clearPendingMatches(): void {
    this.pendingMatches = [];
  }

  /**
   * Retourne le nombre de matchs en attente
   */
  getPendingMatchesCount(): number {
    return this.pendingMatches.length;
  }
}

// Ré-export pour faciliter l'utilisation
export { Player, Match, Glicko2Calculator, CONSTANTS, DEFAULT_CONFIG };
export type { 
  Glicko2Config, 
  PartialConfig, 
  MatchResult, 
  PlayerData,
  MatchOutcome 
} from "./types.ts";

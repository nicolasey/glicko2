/**
 * Librairie de classement Glicko-2 pour TypeScript/Bun
 * 
 * Basé sur l'algorithme développé par Mark E. Glickman
 * 
 * @example
 * ```typescript
 * import { Glicko2 } from "./index.ts";
 * 
 * // Créer le système
 * const glicko = new Glicko2();
 * 
 * // Créer des joueurs
 * const alice = glicko.createPlayer("alice");
 * const bob = glicko.createPlayer("bob");
 * const charlie = glicko.createPlayer("charlie");
 * 
 * // Enregistrer des matchs
 * glicko.recordMatch("alice", "bob", 1);    // Alice bat Bob
 * glicko.recordMatch("bob", "charlie", 1);  // Bob bat Charlie
 * glicko.recordMatch("alice", "charlie", 0.5); // Match nul
 * 
 * // Calculer les nouveaux ratings
 * glicko.updateRatings();
 * 
 * // Afficher le classement
 * console.log(glicko.getLeaderboard());
 * 
 * // Prédire un résultat
 * const prob = glicko.predict("alice", "bob");
 * console.log(`Probabilité de victoire d'Alice : ${(prob * 100).toFixed(1)}%`);
 * ```
 */

// Exports principaux
export { Glicko2 } from "../src/glicko2.ts";
export { Player } from "../src/player.ts";
export { Glicko2Calculator, Match } from "../src/calculator.ts";
export {
  CONSTANTS,
  DEFAULT_CONFIG,
  type Glicko2Config,
  type PartialConfig,
  type MatchResult,
  type PlayerData,
  type RatingUpdate,
  type MatchOutcome,
} from "../src/types.ts";

// Exemple d'utilisation si exécuté directement
if (import.meta.main) {
  console.log("=== Démonstration du système de classement Glicko-2 ===\n");
  
  const { Glicko2 } = await import("../src/glicko2.ts");
  
  // Créer le système avec la configuration par défaut
  const glicko = new Glicko2({
    tau: 0.5,
    defaultRating: 1500,
    defaultRd: 350,
    defaultVolatility: 0.06,
  });
  
  // Créer 4 joueurs
  console.log("Création des joueurs :");
  const alice = glicko.createPlayer("Alice");
  const bob = glicko.createPlayer("Bob");
  const charlie = glicko.createPlayer("Charlie");
  const dave = glicko.createPlayer("Dave");
  
  [alice, bob, charlie, dave].forEach(p => console.log(`  ${p.toString()}`));
  
  // Simuler une période de rating avec plusieurs matchs
  console.log("\n--- Période de rating 1 ---");
  
  // Alice bat Bob
  glicko.recordMatch("Alice", "Bob", 1);
  console.log("Match : Alice bat Bob");
  
  // Charlie bat Dave
  glicko.recordMatch("Charlie", "Dave", 1);
  console.log("Match : Charlie bat Dave");
  
  // Alice bat Charlie
  glicko.recordMatch("Alice", "Charlie", 1);
  console.log("Match : Alice bat Charlie");
  
  // Bob fait match nul avec Dave
  glicko.recordMatch("Bob", "Dave", 0.5);
  console.log("Match : Bob fait match nul avec Dave");
  
  // Calculer les nouveaux ratings
  glicko.updateRatings();
  
  console.log("\nRatings après période 1 :");
  glicko.getLeaderboard().forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.toString()}`);
  });
  
  // Simuler une deuxième période de rating
  console.log("\n--- Période de rating 2 ---");
  
  // Bob bat Charlie (surprise !)
  glicko.recordMatch("Bob", "Charlie", 1);
  console.log("Match : Bob bat Charlie (surprise !)");
  
  // Dave bat Alice (encore plus surprenant !)
  glicko.recordMatch("Dave", "Alice", 1);
  console.log("Match : Dave bat Alice (encore plus surprenant !)");
  
  glicko.updateRatings();
  
  console.log("\nRatings après période 2 :");
  glicko.getLeaderboard().forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.toString()}`);
  });
  
  // Démonstration des prédictions
  console.log("\n--- Prédictions ---");
  const prob1 = glicko.predict("Alice", "Bob");
  console.log(`Probabilité de victoire d'Alice contre Bob : ${(prob1 * 100).toFixed(1)}%`);
  
  const prob2 = glicko.predict("Charlie", "Dave");
  console.log(`Probabilité de victoire de Charlie contre Dave : ${(prob2 * 100).toFixed(1)}%`);
  
  // Classement avec intervalles de confiance
  console.log("\n--- Classement avec intervalles de confiance (95%) ---");
  glicko.getLeaderboardWithConfidence().forEach((item, i) => {
    const { player, lowerBound, upperBound } = item;
    console.log(
      `  ${i + 1}. ${player.id}: ${player.rating.toFixed(2)} ` +
      `[${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)}]`
    );
  });
  
  console.log("\n=== Fin de la démonstration ===");
}
/**
 * Glicko-2 rating library for TypeScript/Bun
 * 
 * Based on the algorithm developed by Mark E. Glickman
 * 
 * @example
 * ```typescript
 * import { Glicko2 } from "./index.ts";
 * 
 * // Create the system
 * const glicko = new Glicko2();
 * 
 * // Create players
 * const alice = glicko.createPlayer("alice");
 * const bob = glicko.createPlayer("bob");
 * const charlie = glicko.createPlayer("charlie");
 * 
 * // Record matches
 * glicko.recordMatch("alice", "bob", 1);    // Alice beats Bob
 * glicko.recordMatch("bob", "charlie", 1);  // Bob beats Charlie
 * glicko.recordMatch("alice", "charlie", 0.5); // Draw
 * 
 * // Compute the new ratings
 * glicko.updateRatings();
 * 
 * // Print the leaderboard
 * console.log(glicko.getLeaderboard());
 * 
 * // Predict a result
 * const prob = glicko.predict("alice", "bob");
 * console.log(`Alice win probability: ${(prob * 100).toFixed(1)}%`);
 * ```
 */

// Main exports
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

// Usage example when run directly
if (import.meta.main) {
  console.log("=== Glicko-2 rating system demo ===\n");
  
  const { Glicko2 } = await import("../src/glicko2.ts");
  
  // Create the system with the default configuration
  const glicko = new Glicko2({
    tau: 0.5,
    defaultRating: 1500,
    defaultRd: 350,
    defaultVolatility: 0.06,
  });
  
  // Create 4 players
  console.log("Creating players:");
  const alice = glicko.createPlayer("Alice");
  const bob = glicko.createPlayer("Bob");
  const charlie = glicko.createPlayer("Charlie");
  const dave = glicko.createPlayer("Dave");
  
  [alice, bob, charlie, dave].forEach(p => console.log(`  ${p.toString()}`));
  
  // Simulate a rating period with several matches
  console.log("\n--- Rating period 1 ---");
  
  // Alice beats Bob
  glicko.recordMatch("Alice", "Bob", 1);
  console.log("Match: Alice beats Bob");
  
  // Charlie beats Dave
  glicko.recordMatch("Charlie", "Dave", 1);
  console.log("Match: Charlie beats Dave");
  
  // Alice beats Charlie
  glicko.recordMatch("Alice", "Charlie", 1);
  console.log("Match: Alice beats Charlie");
  
  // Bob draws with Dave
  glicko.recordMatch("Bob", "Dave", 0.5);
  console.log("Match: Bob draws with Dave");
  
  // Compute the new ratings
  glicko.updateRatings();
  
  console.log("\nRatings after period 1:");
  glicko.getLeaderboard().forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.toString()}`);
  });
  
  // Simulate a second rating period
  console.log("\n--- Rating period 2 ---");
  
  // Bob beats Charlie (upset!)
  glicko.recordMatch("Bob", "Charlie", 1);
  console.log("Match: Bob beats Charlie (upset!)");
  
  // Dave beats Alice (even bigger upset!)
  glicko.recordMatch("Dave", "Alice", 1);
  console.log("Match: Dave beats Alice (even bigger upset!)");
  
  glicko.updateRatings();
  
  console.log("\nRatings after period 2:");
  glicko.getLeaderboard().forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.toString()}`);
  });
  
  // Prediction demo
  console.log("\n--- Predictions ---");
  const prob1 = glicko.predict("Alice", "Bob");
  console.log(`Alice win probability against Bob: ${(prob1 * 100).toFixed(1)}%`);
  
  const prob2 = glicko.predict("Charlie", "Dave");
  console.log(`Charlie win probability against Dave: ${(prob2 * 100).toFixed(1)}%`);
  
  // Leaderboard with confidence intervals
  console.log("\n--- Leaderboard with 95% confidence intervals ---");
  glicko.getLeaderboardWithConfidence().forEach((item, i) => {
    const { player, lowerBound, upperBound } = item;
    console.log(
      `  ${i + 1}. ${player.id}: ${player.rating.toFixed(2)} ` +
      `[${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)}]`
    );
  });
  
  console.log("\n=== End of demo ===");
}
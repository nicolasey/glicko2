/**
 * Runnable Glicko-2 demo: `bun run demo`
 *
 * API walkthrough lives in the README and docs/CLASSIC.md.
 */

import { Glicko2 } from "../src/glicko2.ts";

// Usage example when run directly
if (import.meta.main) {
  console.log("=== Glicko-2 rating system demo ===\n");
  
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
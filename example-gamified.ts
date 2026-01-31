/**
 * Exemple d'utilisation du système Glicko-2 avec gamification
 * 
 * Ce fichier montre comment utiliser les badges pour gamifier
 * le système de classement avec des bonus et effets spéciaux.
 */

import { GamifiedGlicko2, BadgeEffects } from "./src/gamification/gamified-glicko2.ts";
import type { MatchOutcome } from "./src/calculator.ts";

console.log("🎮 === Système de Classement Glicko-2 Gamifié === 🎮\n");

// Créer le système gamifié
const glicko = new GamifiedGlicko2({
  tau: 0.5,
  defaultRating: 1500,
  defaultRd: 350,
  defaultVolatility: 0.06,
});

// Enregistrer un badge personnalisé supplémentaire
const registry = glicko.getBadgeRegistry();
registry.register({
  id: "veteran",
  name: "Vétéran",
  description: "Après 20 matchs, vous gagnez 10% de points bonus",
  icon: "⭐",
  rarity: "epic",
  conditions: [
    { type: "win" },
    { type: "matches_played_min", count: 20 },
  ],
  effects: [BadgeEffects.ratingMultiplier(1.1, "+10% gains de rating")],
  stackable: false,
});

// Créer des joueurs
console.log("👥 Création des joueurs :");
const alice = glicko.createPlayer("Alice");
const bob = glicko.createPlayer("Bob");
const charlie = glicko.createPlayer("Charlie");

[alice, bob, charlie].forEach(p => {
  console.log(`  ${p.id}: rating=${p.rating.toFixed(0)}, rd=${p.rd.toFixed(0)}`);
});

// Attribuer des badges aux joueurs
console.log("\n🏅 Attribution des badges :");
glicko.awardBadge("Alice", "lucky_beginner");
glicko.awardBadge("Alice", "quick_learner");
glicko.awardBadge("Bob", "beginner_shield");
glicko.awardBadge("Charlie", "lucky_beginner");

// Afficher les badges de chaque joueur
["Alice", "Bob", "Charlie"].forEach(playerId => {
  const badges = glicko.getPlayerBadges(playerId);
  if (badges.length > 0) {
    console.log(`  ${playerId}: ${badges.map(b => `${b.badge.config.icon} ${b.badge.config.name}`).join(", ")}`);
  }
});

// Fonction pour simuler un match avec affichage détaillé
function simulateMatch(
  player1Id: string,
  player2Id: string,
  winnerId: string | null
): void {
  const p1 = glicko.getPlayer(player1Id)!;
  const p2 = glicko.getPlayer(player2Id)!;
  
  // Déterminer le résultat
  let result: 1 | 0.5 | 0;
  if (winnerId === null) result = 0.5;
  else if (winnerId === player1Id) result = 1;
  else result = 0;
  
  console.log(`\n⚔️  Match: ${player1Id} vs ${player2Id}`);
  if (winnerId) {
    console.log(`   Résultat: ${winnerId} gagne !`);
  } else {
    console.log(`   Résultat: Match nul`);
  }
  
  // Créer les MatchOutcome
  const matchP1: MatchOutcome = {
    opponent: p2,
    result,
  };
  const matchP2: MatchOutcome = {
    opponent: p1,
    result: (1 - result) as 1 | 0.5 | 0,
  };
  
  // Calculer avec les effets de badges
  const resultP1 = glicko.calculateRatingWithBadges(p1, [matchP1]);
  const resultP2 = glicko.calculateRatingWithBadges(p2, [matchP2]);
  
  // Afficher les résultats pour le joueur 1
  console.log(`\n   📊 ${player1Id}:`);
  console.log(`      Rating: ${resultP1.originalRating.toFixed(2)} → ${resultP1.modifiedRating.toFixed(2)} (${(resultP1.modifiedRating - resultP1.originalRating) >= 0 ? "+" : ""}${(resultP1.modifiedRating - resultP1.originalRating).toFixed(2)})`);
  
  if (resultP1.appliedEffects.length > 0) {
    console.log(`      🎖️  Effets appliqués:`);
    resultP1.appliedEffects.forEach(effect => {
      console.log(`         • ${effect.badgeName}: ${effect.effect.description}`);
    });
  }
  
  if (resultP1.bonusReasons.length > 0) {
    resultP1.bonusReasons.forEach(reason => console.log(`      ✨ ${reason}`));
  }
  
  console.log(`      💫 XP gagné: ${resultP1.xpGained}`);
  
  // Afficher les résultats pour le joueur 2
  console.log(`\n   📊 ${player2Id}:`);
  console.log(`      Rating: ${resultP2.originalRating.toFixed(2)} → ${resultP2.modifiedRating.toFixed(2)} (${(resultP2.modifiedRating - resultP2.originalRating) >= 0 ? "+" : ""}${(resultP2.modifiedRating - resultP2.originalRating).toFixed(2)})`);
  
  if (resultP2.appliedEffects.length > 0) {
    console.log(`      🎖️  Effets appliqués:`);
    resultP2.appliedEffects.forEach(effect => {
      console.log(`         • ${effect.badgeName}: ${effect.effect.description}`);
    });
  }
  
  if (resultP2.bonusReasons.length > 0) {
    resultP2.bonusReasons.forEach(reason => console.log(`      ✨ ${reason}`));
  }
  
  console.log(`      💫 XP gagné: ${resultP2.xpGained}`);
}

// Simuler plusieurs matchs
console.log("\n" + "=".repeat(50));
console.log("📅 TOURNOI - Phase 1");
console.log("=".repeat(50));

// Match 1: Alice bat Bob (Alice a lucky_beginner, donc +50%)
simulateMatch("Alice", "Bob", "Alice");

// Match 2: Charlie bat Bob
simulateMatch("Charlie", "Bob", "Charlie");

// Match 3: Alice vs Charlie - match nul
simulateMatch("Alice", "Charlie", null);

console.log("\n" + "=".repeat(50));
console.log("📅 TOURNOI - Phase 2 (Séries et surprises)");
console.log("=".repeat(50));

// Match 4: Alice continue de gagner (débloque peut-être win_streak)
simulateMatch("Alice", "Bob", "Alice");

// Match 5: Bob gagne enfin ! (Charlie était favori - bonus outsider ?)
// Donnons à Charlie un rating plus élevé pour tester le badge david_goliath
const charliePlayer = glicko.getPlayer("Charlie")!;
// Simulons que Charlie a un meilleur rating
simulateMatch("Bob", "Charlie", "Bob");

// Match 6: Alice vs Charlie, Charlie gagne (série de défaites pour Alice)
simulateMatch("Alice", "Charlie", "Charlie");

// Match 7: Alice perd encore (tester le badge perseverance)
simulateMatch("Alice", "Bob", "Bob");

// Match 8: Alice gagne enfin ! (devrait activer perseverance)
simulateMatch("Alice", "Bob", "Alice");

console.log("\n" + "=".repeat(50));
console.log("📊 CLASSEMENT FINAL");
console.log("=".repeat(50));

// Afficher le classement avec statistiques
const leaderboard = [alice, bob, charlie]
  .sort((a, b) => b.rating - a.rating);

leaderboard.forEach((player, index) => {
  const stats = glicko.getPlayerStats(player.id);
  const xp = glicko.getPlayerXP(player.id);
  const badges = glicko.getPlayerBadges(player.id);
  
  console.log(`\n   ${index + 1}. ${player.id}`);
  console.log(`      Rating: ${player.rating.toFixed(2)} (±${player.rd.toFixed(2)})`);
  console.log(`      Record: ${stats.wins}V / ${stats.losses}D / ${stats.draws}N`);
  console.log(`      Série: ${stats.winStreak} victoire(s) consécutive(s)`);
  console.log(`      Niveau ${xp.level} (${xp.currentXP}/${xp.nextLevelThreshold} XP)`);
  console.log(`      XP Total: ${xp.totalXP}`);
  
  if (badges.length > 0) {
    console.log(`      Badges: ${badges.map(b => `${b.badge.config.icon}`).join(" ")}`);
  }
});

console.log("\n" + "=".repeat(50));
console.log("🎯 Détails des badges");
console.log("=".repeat(50));

// Afficher tous les badges disponibles
const allBadges = registry.getAll();
allBadges.forEach(badge => {
  console.log(`\n   ${badge.config.icon} ${badge.config.name} [${badge.config.rarity}]`);
  console.log(`   ${badge.config.description}`);
  console.log(`   Effets: ${badge.config.effects.map(e => e.description).join(", ")}`);
  if (badge.config.duration) {
    console.log(`   Durée: ${badge.config.duration} match(s)`);
  }
  console.log(`   Stackable: ${badge.config.stackable ? "Oui" : "Non"}`);
});

console.log("\n✨ === Démonstration terminée === ✨");

// Export pour utilisation externe
export { glicko, simulateMatch };

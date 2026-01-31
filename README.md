# Glicko-2 Ranking System

Une librairie TypeScript/Bun complète pour implémenter le système de classement Glicko-2, développé par Mark E. Glickman.

## Qu'est-ce que Glicko-2 ?

Le système Glicko-2 est une méthode de classement pour les jeux compétitifs qui améliore le système Elo traditionnel. Contrairement à Elo, Glicko-2 prend en compte :

- **Le rating** (μ) : le niveau estimé du joueur
- **La déviation du rating** (φ) : l'incertitude sur le rating
- **La volatilité** (σ) : la mesure dans laquelle le rating fluctue

## Installation

```bash
bun install
```

## Utilisation rapide

```typescript
import { Glicko2 } from "./index.ts";

// Créer le système
const glicko = new Glicko2();

// Créer des joueurs
const alice = glicko.createPlayer("alice");
const bob = glicko.createPlayer("bob");

// Enregistrer des matchs (1 = victoire P1, 0 = victoire P2, 0.5 = nul)
glicko.recordMatch("alice", "bob", 1);
glicko.recordMatch("bob", "alice", 0); // Bob bat Alice

// Calculer les nouveaux ratings
glicko.updateRatings();

// Afficher les résultats
console.log(alice.rating);  // Nouveau rating
console.log(alice.rd);      // Nouvelle déviation
console.log(alice.volatility); // Nouvelle volatilité
```

## API

### Classe `Glicko2`

#### Création

```typescript
const glicko = new Glicko2({
  tau: 0.5,              // Contrainte sur la volatilité
  defaultRating: 1500,   // Rating initial
  defaultRd: 350,        // Déviation initiale
  defaultVolatility: 0.06, // Volatilité initiale
  ratingPeriod: 86400,   // Période de rating en secondes
});
```

#### Méthodes

- `createPlayer(id, rating?, rd?, volatility?)` - Créer un nouveau joueur
- `getPlayer(id)` - Récupérer un joueur existant
- `recordMatch(p1, p2, result)` - Enregistrer un match
- `recordMatchWithWinner(p1, p2, winnerId)` - Enregistrer avec gagnant
- `updateRatings()` - Calculer les nouveaux ratings
- `predict(p1, p2)` - Prédire la probabilité de victoire
- `getLeaderboard()` - Obtenir le classement
- `getLeaderboardWithConfidence()` - Classement avec intervalles de confiance à 95%
- `applyDecay(date?)` - Appliquer la décroissance aux joueurs inactifs

### Classe `Player`

```typescript
interface Player {
  id: string;           // Identifiant unique
  rating: number;       // Rating (échelle Glicko-1 : ~1500)
  rd: number;          // Déviation du rating
  volatility: number;  // Volatilité σ
  mu: number;          // Rating μ (échelle Glicko-2)
  phi: number;         // Déviation φ (échelle Glicko-2)
  lastRatingPeriod: Date; // Dernière période de rating
}
```

## Exemple complet

```typescript
import { Glicko2 } from "./index.ts";

const glicko = new Glicko2();

// Créer 3 joueurs
const p1 = glicko.createPlayer("Alice", 1500, 200, 0.06);
const p2 = glicko.createPlayer("Bob", 1400, 30, 0.06);
const p3 = glicko.createPlayer("Charlie", 1550, 100, 0.06);

// Premier tournoi
glicko.recordMatch("Alice", "Bob", 1);     // Alice bat Bob
glicko.recordMatch("Bob", "Charlie", 0.5); // Match nul
glicko.recordMatch("Alice", "Charlie", 0); // Charlie bat Alice

glicko.updateRatings();

// Afficher le classement
glicko.getLeaderboard().forEach((player, i) => {
  console.log(`${i + 1}. ${player.id}: ${player.rating.toFixed(0)} (±${player.rd.toFixed(0)})`);
});

// Prédire un futur match
const prob = glicko.predict("Alice", "Bob");
console.log(`Probabilité victoire Alice: ${(prob * 100).toFixed(1)}%`);
```

## 🎮 Gamification (Système de Badges)

Le système Glicko-2 peut être étendu avec des mécaniques de jeu via `GamifiedGlicko2` :

### Installation

```typescript
import { GamifiedGlicko2, BadgeEffects } from "./src/gamification";
```

### Utilisation basique

```typescript
const glicko = new GamifiedGlicko2();

// Créer des joueurs
const alice = glicko.createPlayer("alice");
const bob = glicko.createPlayer("bob");

// Attribuer des badges
const badge = glicko.awardBadge("alice", "lucky_beginner");

// Calculer avec effets de badges
const result = glicko.calculateRatingWithBadges(alice, [{
  opponent: bob,
  result: 1, // Victoire
}]);

console.log(`Rating: ${result.originalRating} → ${result.modifiedRating}`);
console.log(`XP gagné: ${result.xpGained}`);
console.log(`Badges actifs: ${result.appliedEffects.map(e => e.badgeName).join(", ")}`);
```

### Types de badges intégrés

| Badge | Icône | Effet | Condition |
|-------|-------|-------|-----------|
| Débutant Chanceux | 🍀 | +50% gains de rating | 10 premiers matchs |
| Série Victorieuse | 🔥 | +20% gains | 3+ victoires consécutives |
| David vs Goliath | ⚔️ | x2 gains | Battre un adversaire +200 points |
| Bouclier du Débutant | 🛡️ | -50% pertes | Défaites (10 premiers matchs) |
| Persévérance | 💪 | +30% gains | Victoire après 3 défaites |
| Maître Confirmé | 👑 | -20% volatilité | Rating > 2000, 50+ matchs |
| Apprentissage Rapide | ⚡ | -25% réduction RD | Permanent |

### Créer des badges personnalisés

```typescript
// Via le registre
const registry = glicko.getBadgeRegistry();

registry.register({
  id: "my_badge",
  name: "Super Gagnant",
  description: "Bonus de 25% pour les victoires",
  icon: "🏆",
  rarity: "epic",
  conditions: [
    { type: "win" },
    { type: "win_streak_min", count: 5 },
  ],
  effects: [BadgeEffects.ratingMultiplier(1.25)],
  stackable: true,
  maxStacks: 3,
});

// Ou avec une condition personnalisée
registry.register({
  id: "custom_badge",
  name: "Badge Personnalisé",
  description: "Bonus spécial",
  rarity: "legendary",
  conditions: [{
    type: "custom",
    check: (context) => {
      // Logique personnalisée
      return context.player.rating > 1800 && context.isUnderdog;
    },
  }],
  effects: [
    BadgeEffects.ratingMultiplier(1.5),
    BadgeEffects.xpBoost(2.0),
  ],
  stackable: false,
});
```

### Types de conditions

- `always` - Toujours actif
- `win` / `loss` / `draw` - Selon le résultat
- `underdog_win` - Victoire en tant qu'outsider
- `win_streak_min` - Série de victoires
- `consecutive_losses_min` - Série de défaites
- `rating_above` / `rating_below` - Seuil de rating
- `matches_played_min` / `matches_played_max` - Nombre de matchs
- `opponent_rating_above` / `opponent_rating_below` - Rating adversaire
- `unexpected_result` - Victoire improbable ou défaite attendue
- `custom` - Fonction de vérification personnalisée

### Types d'effets

```typescript
// Multiplicateur de gains
BadgeEffects.ratingMultiplier(1.5);      // +50% gains

// Protection contre les pertes  
BadgeEffects.lossProtection(0.5);        // -50% pertes

// Consolation après défaites
BadgeEffects.consolation(1.3);           // +30% prochaine victoire

// Réduction de volatilité
BadgeEffects.volatilityReduction(0.8);   // -20% volatilité

// Réduction de déviation
BadgeEffects.rdBoost(0.75);              // -25% RD
```

### Système d'XP et niveaux

Chaque match rapporte de l'XP :
- **Base** : 10 XP
- **Victoire** : +20 XP
- **Match nul** : +10 XP  
- **Défaite** : +5 XP (participation)
- **Bonus outsider** : +1 XP par tranche de 50 points de différence (max 50)
- **Bonus série** : +5 XP par victoire consécutive

Les niveaux progressent avec une courbe exponentielle (×1.2 par niveau).

### Statistiques de joueurs

```typescript
const stats = glicko.getPlayerStats("alice");
console.log(stats);
// {
//   wins: 10,
//   losses: 3,
//   draws: 2,
//   winStreak: 3,
//   consecutiveLosses: 0,
//   highestRating: 1850,
//   lowestRating: 1420,
//   totalMatches: 15
// }

const xp = glicko.getPlayerXP("alice");
console.log(xp);
// {
//   currentXP: 450,
//   level: 5,
//   totalXP: 2450,
//   nextLevelThreshold: 518
// }
```

### Démonstration gamifiée

```bash
bun run example-gamified.ts
```

## Architecture

```
src/
├── types.ts              # Types et interfaces
├── player.ts             # Classe Player
├── calculator.ts         # Moteur de calcul Glicko-2
├── glicko2.ts            # Classe principale
└── gamification/
    ├── types.ts          # Types pour la gamification
    ├── badge.ts          # Système de badges
    ├── gamified-glicko2.ts # Extension gamifiée
    └── index.ts          # Exports du module
```

## Formules mathématiques

Le système utilise les formules suivantes :

- `g(φ) = 1 / √(1 + 3φ²/π²)`
- `E(μ, μj, φj) = 1 / (1 + exp(-g(φj)(μ - μj)))`
- `v = [Σ g(φj)² · E(μ, μj, φj) · (1 - E(μ, μj, φj))]⁻¹`
- `Δ = v · Σ g(φj) · (s - E(μ, μj, φj))`

## Référence

- [Glicko-2 System](http://www.glicko.net/glicko/glicko2.pdf) - Document original par Mark E. Glickman

## Licence

MIT

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

## Extension

Le système expose un hook `onRatingUpdate` pour brancher des mécaniques tierces (XP, badges, logs) sans modifier le cœur :

```typescript
const glicko = new Glicko2({
  onRatingUpdate: (playerId, prev, next) => {
    console.log(`${playerId}: ${prev.rating.toFixed(0)} → ${next.rating.toFixed(0)}`);
  },
});
```

Le callback reçoit l'ID du joueur, son état avant mise à jour, et son état après. Il est appelé une fois par joueur à chaque `updateRatings()`.

## Architecture

```
src/
├── types.ts        # Types et interfaces
├── player.ts       # Classe Player
├── calculator.ts   # Moteur de calcul Glicko-2
└── glicko2.ts      # Classe principale
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

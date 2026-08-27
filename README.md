# Glicko-2 Ranking System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Une librairie TypeScript/Bun complète pour implémenter le système de classement Glicko-2, développé par Mark E. Glickman.

## Qu'est-ce que Glicko-2 ?

Le système Glicko-2 est une méthode de classement pour les jeux compétitifs qui améliore le système Elo traditionnel. Contrairement à Elo, Glicko-2 prend en compte :

- **Le rating** (μ) : le niveau estimé du joueur
- **La déviation du rating** (φ) : l'incertitude sur le rating
- **La volatilité** (σ) : la mesure dans laquelle le rating fluctue

## Installation

```bash
bun install @nicolasey/glicko2
```

## Utilisation rapide

```typescript
import { Glicko2 } from "@nicolasey/glicko2";

// Créer le système
const glicko = new Glicko2();

// Créer les joueurs (obligatoire avant d'enregistrer leurs matchs)
const alice = glicko.createPlayer("alice");
const bob = glicko.createPlayer("bob");

// Enregistrer des matchs — le résultat est du point de vue du joueur 1
glicko.recordMatch("alice", "bob", 1);   // Alice bat Bob
glicko.recordMatch("bob", "alice", 1);   // Bob bat Alice
glicko.recordMatch("alice", "bob", 0.5); // Match nul

// Calculer les nouveaux ratings et vider la file des matchs
glicko.updateRatings();

// Les instances Player sont mises à jour en place
console.log(alice.rating);     // Nouveau rating
console.log(alice.rd);         // Nouvelle déviation
console.log(alice.volatility); // Nouvelle volatilité
```

Trois règles à retenir :

1. Les matchs sont **mis en file d'attente**, ils ne changent rien tant que `updateRatings()` n'est pas appelé.
2. `updateRatings()` traite tous les matchs en attente comme **une seule période de rating**, puis vide la file. Appelez-le une fois par période (fin de journée, de tournoi, de saison…), pas après chaque match.
3. Les deux joueurs d'un match doivent exister au moment de `updateRatings()`, sinon une erreur est levée.

## API

### Classe `Glicko2`

#### Création

```typescript
const glicko = new Glicko2({
  tau: 0.5,                // Contrainte sur la volatilité (0.3–1.2)
  epsilon: 0.000001,       // Seuil de convergence de l'algorithme
  defaultRating: 1500,     // Rating initial
  defaultRd: 350,          // Déviation initiale
  defaultVolatility: 0.06, // Volatilité initiale
  ratingPeriod: 86400,     // Durée d'une période en secondes (utilisée par applyDecay)
  onRatingUpdate: undefined, // Hook, voir « Extension »
});
```

Toutes les options sont facultatives ; `new Glicko2()` utilise les valeurs ci-dessus.

#### Joueurs

- `createPlayer(id, rating?, rd?, volatility?): Player` — crée un joueur. **Lève une erreur si l'ID existe déjà.**
- `getPlayer(id): Player | undefined` — récupère un joueur.
- `removePlayer(id): boolean` — supprime un joueur, `true` s'il existait.
- `getAllPlayers(): Player[]` — tous les joueurs, sans ordre garanti.

#### Matchs

- `recordMatch(p1, p2, result, timestamp?)` — met un match en file. `result` vaut `1` (victoire de `p1`), `0` (victoire de `p2`) ou `0.5` (nul).
- `recordMatchWithWinner(p1, p2, winnerId, timestamp?)` — idem, en passant l'ID du gagnant (`null` = match nul).
- `getPendingMatchesCount(): number` — nombre de matchs en attente.
- `clearPendingMatches()` — jette les matchs en attente sans les traiter.

#### Ratings

- `updateRatings(): Player[]` — calcule les nouveaux ratings, retourne les joueurs modifiés et vide la file. Retourne `[]` si aucun match n'est en attente.
- `applyDecay(currentDate?): Player[]` — augmente la déviation des joueurs inactifs. Voir « Inactivité ».
- `predict(p1, p2): number` — probabilité de victoire de `p1`, entre 0 et 1. Lève une erreur si un joueur n'existe pas.
- `getLeaderboard(descending = true): Player[]` — classement par rating.
- `getLeaderboardWithConfidence(): Array<{ player, lowerBound, upperBound }>` — classement avec intervalle de confiance à 95 % (`rating ± 1.96 × rd`).

#### Persistance

- `serialize()` — retourne un objet JSON-compatible (joueurs, matchs en attente, configuration).
- `Glicko2.deserialize(data)` — recrée un système depuis cet objet (méthode statique).

```typescript
const snapshot = JSON.stringify(glicko.serialize());
const restored = Glicko2.deserialize(JSON.parse(snapshot));
```

Le hook `onRatingUpdate` n'est pas sérialisable : repassez-le après restauration si vous en utilisez un.

### Classe `Player`

Les propriétés sont en lecture seule ; elles sont mises à jour par le système.

```typescript
player.id;               // string  — identifiant unique
player.rating;           // number  — rating (échelle Glicko-1, ~1500)
player.rd;               // number  — déviation du rating
player.volatility;       // number  — volatilité σ
player.mu;               // number  — rating μ (échelle Glicko-2)
player.phi;              // number  — déviation φ (échelle Glicko-2)
player.lastRatingPeriod; // Date    — dernière période de rating
player.expectedScore(opponent); // number — score attendu face à un adversaire
player.toData();         // PlayerData — objet sérialisable
```

## Exemple complet

```typescript
import { Glicko2 } from "@nicolasey/glicko2";

const glicko = new Glicko2();

// Créer 3 joueurs
glicko.createPlayer("Alice", 1500, 200, 0.06);
glicko.createPlayer("Bob", 1400, 30, 0.06);
glicko.createPlayer("Charlie", 1550, 100, 0.06);

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

D'autres exemples exécutables sont dans [`examples/`](examples/) et [`docs/`](docs/).

## Inactivité

Un joueur qui ne joue pas devient moins prévisible : sa déviation doit remonter. `applyDecay()` compare `lastRatingPeriod` de chaque joueur à la date courante et applique une période de décroissance par tranche de `ratingPeriod` écoulée.

```typescript
// À appeler périodiquement (cron quotidien, au démarrage, avant un matchmaking…)
const touched = glicko.applyDecay();          // date courante
glicko.applyDecay(new Date("2026-01-01"));    // ou une date explicite
```

Seul `rd` change ; le rating reste identique.

## Extension

Le système expose un hook `onRatingUpdate` pour brancher des mécaniques tierces (XP, badges, logs) sans modifier le cœur :

```typescript
const glicko = new Glicko2({
  onRatingUpdate: (playerId, prev, next) => {
    console.log(`${playerId}: ${prev.rating.toFixed(0)} → ${next.rating.toFixed(0)}`);
  },
});
```

Le callback reçoit l'ID du joueur, son état avant mise à jour, et son état après (`{ rating, rd, volatility }`). Il est appelé une fois par joueur à chaque `updateRatings()`.

## Développement

```bash
bun install   # dépendances
bun test      # suite de tests
bun run demo  # démonstration (index.ts)
```

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

[MIT](LICENSE)

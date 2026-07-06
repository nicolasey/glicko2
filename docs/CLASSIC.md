# Utilisation classique de Glicko-2

## Installation

```typescript
import { Glicko2 } from "./src/glicko2.ts";
```

## Démarrage rapide

```typescript
const glicko = new Glicko2();

const alice = glicko.createPlayer("alice");
const bob   = glicko.createPlayer("bob");

glicko.recordMatch("alice", "bob", 1); // 1 = victoire alice, 0 = victoire bob, 0.5 = nul

const updated = glicko.updateRatings();
console.log(alice.rating, alice.rd);
```

## Configuration

Tous les paramètres sont optionnels.

```typescript
const glicko = new Glicko2({
  tau:              0.5,    // contrainte volatilité (0.3–1.2 selon stabilité du jeu)
  defaultRating:    1500,   // rating de départ
  defaultRd:        350,    // incertitude de départ (haut = nouveau joueur)
  defaultVolatility: 0.06,  // instabilité de départ
  ratingPeriod:     86400,  // durée d'une période en secondes (ici 1 jour)
});
```

**`tau`** est le seul paramètre qui change réellement le comportement : valeur basse (~0.3) = ratings stables, valeur haute (~1.2) = ratings très réactifs aux surprises.

## Créer des joueurs

```typescript
// Rating/RD personnalisés pour un joueur importé d'un autre système
const veteran = glicko.createPlayer("veteran", 1800, 80, 0.05);

// Récupérer un joueur existant
const p = glicko.getPlayer("alice"); // Player | undefined

// Tous les joueurs
const all = glicko.getAllPlayers(); // Player[]
```

Un `Player` expose : `id`, `rating`, `rd`, `volatility`.

## Enregistrer des matchs

```typescript
// Par résultat explicite (du point de vue du joueur 1)
glicko.recordMatch("alice", "bob", 1);   // alice gagne
glicko.recordMatch("alice", "bob", 0);   // bob gagne
glicko.recordMatch("alice", "bob", 0.5); // nul

// Par vainqueur (plus lisible)
glicko.recordMatchWithWinner("alice", "bob", "alice"); // alice gagne
glicko.recordMatchWithWinner("alice", "bob", null);    // nul

// Avec timestamp (pour applyDecay, voir plus bas)
glicko.recordMatch("alice", "bob", 1, new Date("2024-03-15"));
```

Les matchs s'accumulent en attente jusqu'à `updateRatings()`.

## Calculer les ratings

```typescript
// Traite tous les matchs en attente, retourne les joueurs mis à jour
const updated = glicko.updateRatings();
```

Appeler `updateRatings()` une fois par période de rating (quotidien, hebdomadaire…).  
Les joueurs sans match pendant la période ne sont pas affectés — utiliser `applyDecay()` pour eux.

## Décroissance des joueurs inactifs

Glicko-2 augmente le RD des joueurs inactifs pour refléter l'incertitude croissante.

```typescript
// À appeler à la fin de chaque période, après updateRatings()
const decayed = glicko.applyDecay();
```

`applyDecay()` parcourt tous les joueurs et augmente leur RD proportionnellement au nombre de périodes écoulées depuis leur dernier match.

## Classement

```typescript
// Trié par rating décroissant
const board = glicko.getLeaderboard();

// Avec intervalles de confiance à 95%
const boardWithCI = glicko.getLeaderboardWithConfidence();
// [{ player, lowerBound, upperBound }, ...]
```

Un RD élevé donne un intervalle large : le joueur est peu fiable dans le classement.

## Prédire un résultat

```typescript
const prob = glicko.predict("alice", "bob");
// Probabilité de victoire d'alice (0–1)
console.log(`Alice gagne dans ${(prob * 100).toFixed(1)}% des cas`);
```

## Persistance

```typescript
// Sauvegarder
const snapshot = glicko.serialize();
const json = JSON.stringify(snapshot);

// Restaurer
const glicko2 = Glicko2.deserialize(JSON.parse(json));
```

## Flux complet (exemple quotidien)

```typescript
import { Glicko2 } from "./src/glicko2.ts";

const glicko = new Glicko2({ tau: 0.5, ratingPeriod: 86400 });

// --- Jour 1 : inscription ---
glicko.createPlayer("alice");
glicko.createPlayer("bob");
glicko.createPlayer("charlie");

// --- Jour 1 : matchs du jour ---
glicko.recordMatchWithWinner("alice",   "bob",     "alice");
glicko.recordMatchWithWinner("bob",     "charlie", "bob");
glicko.recordMatchWithWinner("alice",   "charlie", "alice");

// --- Fin de journée : mise à jour ---
glicko.updateRatings();
glicko.applyDecay();

// --- Classement ---
for (const p of glicko.getLeaderboard()) {
  console.log(`${p.id}: ${p.rating.toFixed(0)} ± ${p.rd.toFixed(0)}`);
}
```

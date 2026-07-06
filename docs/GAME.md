# Glicko-2 pour les jeux — gamification via configuration

Le cœur du système reste identique. La gamification se branche via deux leviers :

1. **La configuration** — `tau`, `defaultRd`, `defaultVolatility`, `ratingPeriod` changent le comportement de toute la courbe de progression.
2. **Le hook `onRatingUpdate`** — point d'extension pour XP, badges, streaks, notifications, sans toucher au moteur.

## Le hook onRatingUpdate

```typescript
import { Glicko2 } from "./src/glicko2.ts";
import type { PlayerSnapshot } from "./src/glicko2.ts";

const glicko = new Glicko2({
  onRatingUpdate: (playerId: string, prev: PlayerSnapshot, next: PlayerSnapshot) => {
    const delta = next.rating - prev.rating;
    console.log(`${playerId}: ${prev.rating.toFixed(0)} → ${next.rating.toFixed(0)} (${delta >= 0 ? "+" : ""}${delta.toFixed(0)})`);
  },
});
```

Le callback est appelé une fois par joueur après chaque `updateRatings()`.  
`prev` et `next` contiennent `{ rating, rd, volatility }`.

## Recettes de gamification

### XP proportionnel au delta de rating

```typescript
const xp: Map<string, number> = new Map();

const glicko = new Glicko2({
  onRatingUpdate: (playerId, prev, next) => {
    const delta = next.rating - prev.rating;
    const gained = delta > 0 ? Math.round(delta * 2) : 5; // participation XP en cas de défaite
    xp.set(playerId, (xp.get(playerId) ?? 0) + gained);
  },
});
```

### Détection de victoire upset (outsider qui gagne)

```typescript
const glicko = new Glicko2({
  onRatingUpdate: (playerId, prev, next) => {
    const delta = next.rating - prev.rating;
    // Un gros gain de rating sur un seul match = victoire surprise
    if (delta > 50) {
      console.log(`🎉 ${playerId} upset ! +${delta.toFixed(0)} points`);
      // → déclencher badge "David vs Goliath"
    }
  },
});
```

### Badge "Série de victoires" via état externe

```typescript
const streaks: Map<string, number> = new Map();

const glicko = new Glicko2({
  onRatingUpdate: (playerId, prev, next) => {
    const delta = next.rating - prev.rating;
    if (delta > 0) {
      const streak = (streaks.get(playerId) ?? 0) + 1;
      streaks.set(playerId, streak);
      if (streak === 3) console.log(`🔥 ${playerId} est en série de 3 victoires !`);
    } else {
      streaks.set(playerId, 0); // réinitialiser sur défaite ou nul
    }
  },
});
```

### Protection des débutants (RD élevé = joueur récent)

```typescript
const glicko = new Glicko2({
  onRatingUpdate: (playerId, prev, next) => {
    const isNewPlayer = prev.rd > 200;
    const delta = next.rating - prev.rating;
    if (isNewPlayer && delta < 0) {
      console.log(`🛡️ ${playerId} est protégé (débutant), perte atténuée affichée`);
      // Afficher une perte réduite côté UI, le rating réel reste intact
    }
  },
});
```

## Configuration selon le type de jeu

### Jeu compétitif classique (échecs, ladder ranked)

```typescript
const glicko = new Glicko2({
  tau:               0.3,    // volatilité très contrainte = ratings stables
  defaultRating:     1500,
  defaultRd:         200,    // départ avec incertitude modérée
  defaultVolatility: 0.04,
  ratingPeriod:      604800, // période hebdomadaire
});
```

### Jeu casual / mobile (progression rapide souhaitée)

```typescript
const glicko = new Glicko2({
  tau:               0.8,    // volatilité plus libre = progressions visibles
  defaultRating:     1000,
  defaultRd:         350,    // nouveau joueur très incertain = gros mouvements initiaux
  defaultVolatility: 0.08,
  ratingPeriod:      86400,  // quotidien
});
```

### Tournoi (court terme, ratings très réactifs)

```typescript
const glicko = new Glicko2({
  tau:               1.2,    // très réactif aux surprises
  defaultRating:     1500,
  defaultRd:         350,
  defaultVolatility: 0.09,
  ratingPeriod:      3600,   // période horaire
});
```

## Effet des paramètres sur la courbe de jeu

| Paramètre | Valeur basse | Valeur haute |
|-----------|-------------|-------------|
| `tau` | Ratings stables, peu de surprises | Gros écarts après résultats inattendus |
| `defaultRd` | Nouveaux joueurs classés prudemment | Gros mouvements dès les premiers matchs |
| `defaultVolatility` | Performances régulières attendues | Joueur considéré imprévisible dès le départ |
| `ratingPeriod` | Long → RD monte lentement hors inactivité | Court → inactivité pénalise rapidement |

## Flux complet avec gamification

```typescript
import { Glicko2 } from "./src/glicko2.ts";

const xp: Map<string, number> = new Map();
const streaks: Map<string, number> = new Map();

const glicko = new Glicko2({
  tau:           0.7,
  defaultRd:     300,
  ratingPeriod:  86400,
  onRatingUpdate: (playerId, prev, next) => {
    const delta = next.rating - prev.rating;

    // XP
    const gained = delta > 0 ? Math.round(delta * 2) : 5;
    xp.set(playerId, (xp.get(playerId) ?? 0) + gained);

    // Streak
    if (delta > 0) {
      streaks.set(playerId, (streaks.get(playerId) ?? 0) + 1);
    } else {
      streaks.set(playerId, 0);
    }

    const streak = streaks.get(playerId)!;
    if (streak > 0 && streak % 3 === 0) {
      console.log(`🔥 ${playerId} — série de ${streak} victoires !`);
    }
  },
});

glicko.createPlayer("alice");
glicko.createPlayer("bob");

glicko.recordMatchWithWinner("alice", "bob", "alice");
glicko.recordMatchWithWinner("alice", "bob", "alice");
glicko.recordMatchWithWinner("alice", "bob", "alice");

glicko.updateRatings();
// → "🔥 alice — série de 3 victoires !"

console.log("XP alice :", xp.get("alice"));
```

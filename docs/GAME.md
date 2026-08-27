# Glicko-2 for games — gamification through configuration

The core of the system stays the same. Gamification plugs in through two levers:

1. **Configuration** — `tau`, `defaultRd`, `defaultVolatility`, `ratingPeriod` reshape the whole progression curve.
2. **The `onRatingUpdate` hook** — an extension point for XP, badges, streaks and notifications, without touching the engine.

## The onRatingUpdate hook

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

The callback fires once per player after every `updateRatings()`.  
`prev` and `next` hold `{ rating, rd, volatility }`.

## Gamification recipes

### XP proportional to the rating delta

```typescript
const xp: Map<string, number> = new Map();

const glicko = new Glicko2({
  onRatingUpdate: (playerId, prev, next) => {
    const delta = next.rating - prev.rating;
    const gained = delta > 0 ? Math.round(delta * 2) : 5; // participation XP on a loss
    xp.set(playerId, (xp.get(playerId) ?? 0) + gained);
  },
});
```

### Detecting an upset win (underdog takes it)

```typescript
const glicko = new Glicko2({
  onRatingUpdate: (playerId, prev, next) => {
    const delta = next.rating - prev.rating;
    // A large rating gain over a single match means an upset
    if (delta > 50) {
      console.log(`🎉 ${playerId} upset! +${delta.toFixed(0)} points`);
      // → award the "David vs Goliath" badge
    }
  },
});
```

### "Win streak" badge through external state

```typescript
const streaks: Map<string, number> = new Map();

const glicko = new Glicko2({
  onRatingUpdate: (playerId, prev, next) => {
    const delta = next.rating - prev.rating;
    if (delta > 0) {
      const streak = (streaks.get(playerId) ?? 0) + 1;
      streaks.set(playerId, streak);
      if (streak === 3) console.log(`🔥 ${playerId} is on a 3-win streak!`);
    } else {
      streaks.set(playerId, 0); // reset on a loss or a draw
    }
  },
});
```

### Newcomer protection (high RD = recent player)

```typescript
const glicko = new Glicko2({
  onRatingUpdate: (playerId, prev, next) => {
    const isNewPlayer = prev.rd > 200;
    const delta = next.rating - prev.rating;
    if (isNewPlayer && delta < 0) {
      console.log(`🛡️ ${playerId} is protected (newcomer), softened loss shown`);
      // Display a reduced loss in the UI, the real rating stays intact
    }
  },
});
```

## Configuration per game type

### Classic competitive game (chess, ranked ladder)

```typescript
const glicko = new Glicko2({
  tau:               0.3,    // tightly constrained volatility = stable ratings
  defaultRating:     1500,
  defaultRd:         200,    // start with moderate uncertainty
  defaultVolatility: 0.04,
  ratingPeriod:      604800, // weekly period
});
```

### Casual / mobile game (fast progression wanted)

```typescript
const glicko = new Glicko2({
  tau:               0.8,    // looser volatility = visible progression
  defaultRating:     1000,
  defaultRd:         350,    // very uncertain newcomer = big early swings
  defaultVolatility: 0.08,
  ratingPeriod:      86400,  // daily
});
```

### Tournament (short term, highly reactive ratings)

```typescript
const glicko = new Glicko2({
  tau:               1.2,    // very reactive to upsets
  defaultRating:     1500,
  defaultRd:         350,
  defaultVolatility: 0.09,
  ratingPeriod:      3600,   // hourly period
});
```

## Effect of each option on the game curve

| Option | Low value | High value |
|--------|-----------|------------|
| `tau` | Stable ratings, few surprises | Large swings after unexpected results |
| `defaultRd` | Newcomers ranked cautiously | Big swings from the very first matches |
| `defaultVolatility` | Consistent performance expected | Player treated as unpredictable from the start |
| `ratingPeriod` | Long → RD creeps up slowly while inactive | Short → inactivity is penalised quickly |

## Full flow with gamification

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
      console.log(`🔥 ${playerId} — ${streak}-win streak!`);
    }
  },
});

glicko.createPlayer("alice");
glicko.createPlayer("bob");

glicko.recordMatchWithWinner("alice", "bob", "alice");
glicko.recordMatchWithWinner("alice", "bob", "alice");
glicko.recordMatchWithWinner("alice", "bob", "alice");

glicko.updateRatings();
// → "🔥 alice — 3-win streak!"

console.log("alice XP:", xp.get("alice"));
```

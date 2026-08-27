# Classic Glicko-2 usage

## Installation

```typescript
import { Glicko2 } from "./src/glicko2.ts";
```

## Quick start

```typescript
const glicko = new Glicko2();

const alice = glicko.createPlayer("alice");
const bob   = glicko.createPlayer("bob");

glicko.recordMatch("alice", "bob", 1); // 1 = alice wins, 0 = bob wins, 0.5 = draw

const updated = glicko.updateRatings();
console.log(alice.rating, alice.rd);
```

## Configuration

Every option is optional.

```typescript
const glicko = new Glicko2({
  tau:              0.5,    // volatility constraint (0.3–1.2 depending on how stable the game is)
  defaultRating:    1500,   // starting rating
  defaultRd:        350,    // starting uncertainty (high = new player)
  defaultVolatility: 0.06,  // starting instability
  ratingPeriod:     86400,  // length of a period in seconds (here 1 day)
});
```

**`tau`** is the only option that really changes the behaviour: a low value (~0.3) gives stable ratings, a high value (~1.2) makes ratings react sharply to upsets.

## Creating players

```typescript
// Custom rating/RD for a player imported from another system
const veteran = glicko.createPlayer("veteran", 1800, 80, 0.05);

// Retrieve an existing player
const p = glicko.getPlayer("alice"); // Player | undefined

// Every player
const all = glicko.getAllPlayers(); // Player[]
```

A `Player` exposes: `id`, `rating`, `rd`, `volatility`.

## Recording matches

```typescript
// By explicit result (from player 1's point of view)
glicko.recordMatch("alice", "bob", 1);   // alice wins
glicko.recordMatch("alice", "bob", 0);   // bob wins
glicko.recordMatch("alice", "bob", 0.5); // draw

// By winner (more readable)
glicko.recordMatchWithWinner("alice", "bob", "alice"); // alice wins
glicko.recordMatchWithWinner("alice", "bob", null);    // draw

// With a timestamp (for applyDecay, see below)
glicko.recordMatch("alice", "bob", 1, new Date("2024-03-15"));
```

Matches pile up in the queue until `updateRatings()` runs.

## Computing ratings

```typescript
// Processes every pending match, returns the updated players
const updated = glicko.updateRatings();
```

Call `updateRatings()` once per rating period (daily, weekly…).  
Players with no match during the period are left untouched — use `applyDecay()` for them.

## Decay for inactive players

Glicko-2 widens the RD of inactive players to reflect the growing uncertainty.

```typescript
// Call at the end of each period, after updateRatings()
const decayed = glicko.applyDecay();
```

`applyDecay()` walks every player and widens their RD proportionally to the number of periods elapsed since their last match.

## Leaderboard

```typescript
// Sorted by descending rating
const board = glicko.getLeaderboard();

// With 95% confidence intervals
const boardWithCI = glicko.getLeaderboardWithConfidence();
// [{ player, lowerBound, upperBound }, ...]
```

A high RD gives a wide interval: that player's position is not yet reliable.

## Predicting a result

```typescript
const prob = glicko.predict("alice", "bob");
// Win probability for alice (0–1)
console.log(`Alice wins ${(prob * 100).toFixed(1)}% of the time`);
```

## Persistence

```typescript
// Save
const snapshot = glicko.serialize();
const json = JSON.stringify(snapshot);

// Restore
const glicko2 = Glicko2.deserialize(JSON.parse(json));
```

## Full flow (daily example)

```typescript
import { Glicko2 } from "./src/glicko2.ts";

const glicko = new Glicko2({ tau: 0.5, ratingPeriod: 86400 });

// --- Day 1: sign-ups ---
glicko.createPlayer("alice");
glicko.createPlayer("bob");
glicko.createPlayer("charlie");

// --- Day 1: matches of the day ---
glicko.recordMatchWithWinner("alice",   "bob",     "alice");
glicko.recordMatchWithWinner("bob",     "charlie", "bob");
glicko.recordMatchWithWinner("alice",   "charlie", "alice");

// --- End of day: update ---
glicko.updateRatings();
glicko.applyDecay();

// --- Leaderboard ---
for (const p of glicko.getLeaderboard()) {
  console.log(`${p.id}: ${p.rating.toFixed(0)} ± ${p.rd.toFixed(0)}`);
}
```

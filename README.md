# Glicko-2 Ranking System

[![CI](https://github.com/nicolasey/glicko2/actions/workflows/ci.yml/badge.svg)](https://github.com/nicolasey/glicko2/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40nicolasey%2Fglicko2.svg)](https://www.npmjs.com/package/@nicolasey/glicko2)
[![npm downloads](https://img.shields.io/npm/dm/%40nicolasey%2Fglicko2.svg)](https://www.npmjs.com/package/@nicolasey/glicko2)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A complete TypeScript/Bun library implementing the Glicko-2 rating system, developed by Mark E. Glickman.

## What is Glicko-2?

Glicko-2 is a rating method for competitive games that improves on the traditional Elo system. Unlike Elo, Glicko-2 tracks:

- **Rating** (μ): the player's estimated skill
- **Rating deviation** (φ): the uncertainty about that rating
- **Volatility** (σ): how much the rating is expected to fluctuate

## Installation

```bash
bun install @nicolasey/glicko2
```

## Quick start

```typescript
import { Glicko2 } from "@nicolasey/glicko2";

// Create the system
const glicko = new Glicko2();

// Create players (required before recording their matches)
const alice = glicko.createPlayer("alice");
const bob = glicko.createPlayer("bob");

// Record matches — the result is from player 1's point of view
glicko.recordMatch("alice", "bob", 1);   // Alice beats Bob
glicko.recordMatch("bob", "alice", 1);   // Bob beats Alice
glicko.recordMatch("alice", "bob", 0.5); // Draw

// Compute the new ratings and flush the match queue
glicko.updateRatings();

// Player instances are updated in place
console.log(alice.rating);     // New rating
console.log(alice.rd);         // New deviation
console.log(alice.volatility); // New volatility
```

Three things to keep in mind:

1. Matches are **queued**: nothing changes until `updateRatings()` is called.
2. `updateRatings()` processes every pending match as **a single rating period**, then clears the queue. Call it once per period (end of day, tournament, season…), not after every match.
3. Both players of a match must exist when `updateRatings()` runs, otherwise it throws.

## API

### `Glicko2` class

#### Creation

```typescript
const glicko = new Glicko2({
  tau: 0.5,                  // Volatility constraint (0.3–1.2)
  epsilon: 0.000001,         // Convergence threshold of the algorithm
  defaultRating: 1500,       // Initial rating
  defaultRd: 350,            // Initial deviation
  defaultVolatility: 0.06,   // Initial volatility
  ratingPeriod: 86400,       // Length of a period in seconds (used by applyDecay)
  onRatingUpdate: undefined, // Hook, see "Extension"
});
```

Every option is optional; `new Glicko2()` uses the values above.

#### Players

- `createPlayer(id, rating?, rd?, volatility?): Player` — creates a player. **Throws if the ID already exists.**
- `getPlayer(id): Player | undefined` — retrieves a player.
- `removePlayer(id): boolean` — removes a player, `true` if it existed.
- `getAllPlayers(): Player[]` — every player, in no guaranteed order.

#### Matches

- `recordMatch(p1, p2, result, timestamp?)` — queues a match. `result` is `1` (`p1` wins), `0` (`p2` wins) or `0.5` (draw).
- `recordMatchWithWinner(p1, p2, winnerId, timestamp?)` — same, using the winner's ID (`null` = draw).
- `getPendingMatchesCount(): number` — number of queued matches.
- `clearPendingMatches()` — drops the queued matches without processing them.

#### Ratings

- `updateRatings(): Player[]` — computes the new ratings, returns the updated players and clears the queue. Returns `[]` when no match is pending.
- `applyDecay(currentDate?): Player[]` — raises the deviation of inactive players. See "Inactivity".
- `predict(p1, p2): number` — win probability for `p1`, between 0 and 1. Throws if either player is unknown.
- `getLeaderboard(descending = true): Player[]` — players ranked by rating.
- `getLeaderboardWithConfidence(): Array<{ player, lowerBound, upperBound }>` — leaderboard with 95% confidence intervals (`rating ± 1.96 × rd`).

#### Persistence

- `serialize()` — returns a JSON-friendly object (players, pending matches, config).
- `Glicko2.deserialize(data)` — rebuilds a system from that object (static method).

```typescript
const snapshot = JSON.stringify(glicko.serialize());
const restored = Glicko2.deserialize(JSON.parse(snapshot));
```

The `onRatingUpdate` hook is not serializable: pass it again after restoring if you use one.

### `Player` class

Properties are read-only; the system updates them.

```typescript
player.id;               // string  — unique identifier
player.rating;           // number  — rating (Glicko-1 scale, ~1500)
player.rd;               // number  — rating deviation
player.volatility;       // number  — volatility σ
player.mu;               // number  — rating μ (Glicko-2 scale)
player.phi;              // number  — deviation φ (Glicko-2 scale)
player.lastRatingPeriod; // Date    — last rating period
player.expectedScore(opponent); // number — expected score against an opponent
player.toData();         // PlayerData — serializable object
```

## Full example

```typescript
import { Glicko2 } from "@nicolasey/glicko2";

const glicko = new Glicko2();

// Create 3 players
glicko.createPlayer("Alice", 1500, 200, 0.06);
glicko.createPlayer("Bob", 1400, 30, 0.06);
glicko.createPlayer("Charlie", 1550, 100, 0.06);

// First tournament
glicko.recordMatch("Alice", "Bob", 1);     // Alice beats Bob
glicko.recordMatch("Bob", "Charlie", 0.5); // Draw
glicko.recordMatch("Alice", "Charlie", 0); // Charlie beats Alice

glicko.updateRatings();

// Print the leaderboard
glicko.getLeaderboard().forEach((player, i) => {
  console.log(`${i + 1}. ${player.id}: ${player.rating.toFixed(0)} (±${player.rd.toFixed(0)})`);
});

// Predict an upcoming match
const prob = glicko.predict("Alice", "Bob");
console.log(`Alice win probability: ${(prob * 100).toFixed(1)}%`);
```

More runnable examples live in [`examples/`](examples/) and [`docs/`](docs/).

## Inactivity

A player who stops playing becomes less predictable: their deviation should grow back. `applyDecay()` compares each player's `lastRatingPeriod` with the current date and applies one decay period per elapsed `ratingPeriod`.

```typescript
// Call periodically (daily cron, on startup, before matchmaking…)
const touched = glicko.applyDecay();        // current date
glicko.applyDecay(new Date("2026-01-01"));  // or an explicit date
```

Only `rd` changes; the rating stays the same.

## Extension

The system exposes an `onRatingUpdate` hook so you can plug third-party mechanics (XP, badges, logs) in without touching the core:

```typescript
const glicko = new Glicko2({
  onRatingUpdate: (playerId, prev, next) => {
    console.log(`${playerId}: ${prev.rating.toFixed(0)} → ${next.rating.toFixed(0)}`);
  },
});
```

The callback receives the player ID, the state before the update, and the state after (`{ rating, rd, volatility }`). It fires once per player on every `updateRatings()`.

## Development

```bash
bun install   # dependencies
bun test      # test suite
bun run demo  # demo (examples/index.ts)
```

## Architecture

```
src/
├── types.ts        # Types and interfaces
├── player.ts       # Player class
├── calculator.ts   # Glicko-2 computation engine
└── glicko2.ts      # Main class
```

## Math

The system relies on the following formulas:

- `g(φ) = 1 / √(1 + 3φ²/π²)`
- `E(μ, μj, φj) = 1 / (1 + exp(-g(φj)(μ - μj)))`
- `v = [Σ g(φj)² · E(μ, μj, φj) · (1 - E(μ, μj, φj))]⁻¹`
- `Δ = v · Σ g(φj) · (s - E(μ, μj, φj))`

## Reference

- [Glicko-2 System](http://www.glicko.net/glicko/glicko2.pdf) — original paper by Mark E. Glickman

## License

[MIT](LICENSE)

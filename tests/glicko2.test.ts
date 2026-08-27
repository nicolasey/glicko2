// tests/glicko2.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { Glicko2 } from "../src/glicko2.ts";
import type { PlayerSnapshot } from "../src/glicko2.ts";

describe("Glicko2 — player management", () => {
  let g: Glicko2;
  beforeEach(() => { g = new Glicko2(); });

  it("createPlayer creates a player with the default values", () => {
    const p = g.createPlayer("alice");
    expect(p.id).toBe("alice");
    expect(p.rating).toBe(1500);
    expect(p.rd).toBe(350);
  });

  it("createPlayer with custom values", () => {
    const p = g.createPlayer("bob", 1800, 100, 0.04);
    expect(p.rating).toBe(1800);
    expect(p.rd).toBe(100);
  });

  it("createPlayer throws if the ID already exists", () => {
    g.createPlayer("alice");
    expect(() => g.createPlayer("alice")).toThrow();
  });

  it("getPlayer returns the player or undefined", () => {
    g.createPlayer("alice");
    expect(g.getPlayer("alice")).toBeDefined();
    expect(g.getPlayer("ghost")).toBeUndefined();
  });

  it("removePlayer removes the player", () => {
    g.createPlayer("alice");
    expect(g.removePlayer("alice")).toBe(true);
    expect(g.getPlayer("alice")).toBeUndefined();
  });

  it("removePlayer returns false if the player does not exist", () => {
    expect(g.removePlayer("ghost")).toBe(false);
  });

  it("getAllPlayers returns every player", () => {
    g.createPlayer("a");
    g.createPlayer("b");
    expect(g.getAllPlayers()).toHaveLength(2);
  });
});

describe("Glicko2 — recording matches", () => {
  let g: Glicko2;
  beforeEach(() => {
    g = new Glicko2();
    g.createPlayer("a");
    g.createPlayer("b");
  });

  it("recordMatch increments getPendingMatchesCount", () => {
    g.recordMatch("a", "b", 1);
    expect(g.getPendingMatchesCount()).toBe(1);
  });

  it("recordMatchWithWinner with a winner", () => {
    g.recordMatchWithWinner("a", "b", "a");
    expect(g.getPendingMatchesCount()).toBe(1);
  });

  it("recordMatchWithWinner with a draw (null)", () => {
    g.recordMatchWithWinner("a", "b", null);
    expect(g.getPendingMatchesCount()).toBe(1);
  });

  it("clearPendingMatches empties the queue", () => {
    g.recordMatch("a", "b", 1);
    g.clearPendingMatches();
    expect(g.getPendingMatchesCount()).toBe(0);
  });
});

describe("Glicko2 — updateRatings", () => {
  let g: Glicko2;
  beforeEach(() => {
    g = new Glicko2();
    g.createPlayer("alice");
    g.createPlayer("bob");
  });

  it("returns an empty array when no match is pending", () => {
    expect(g.updateRatings()).toHaveLength(0);
  });

  it("returns the updated players", () => {
    g.recordMatch("alice", "bob", 1);
    const updated = g.updateRatings();
    expect(updated.length).toBeGreaterThan(0);
  });

  it("clears the pending matches after updateRatings", () => {
    g.recordMatch("alice", "bob", 1);
    g.updateRatings();
    expect(g.getPendingMatchesCount()).toBe(0);
  });

  it("win → alice goes up, bob goes down", () => {
    const ratingAliceBefore = g.getPlayer("alice")!.rating;
    const ratingBobBefore   = g.getPlayer("bob")!.rating;
    g.recordMatch("alice", "bob", 1);
    g.updateRatings();
    expect(g.getPlayer("alice")!.rating).toBeGreaterThan(ratingAliceBefore);
    expect(g.getPlayer("bob")!.rating).toBeLessThan(ratingBobBefore);
  });

  it("draw → ratings stay close to the initial values (≤ 20 points apart)", () => {
    g.recordMatch("alice", "bob", 0.5);
    g.updateRatings();
    expect(Math.abs(g.getPlayer("alice")!.rating - 1500)).toBeLessThan(20);
    expect(Math.abs(g.getPlayer("bob")!.rating - 1500)).toBeLessThan(20);
  });
});

describe("Glicko2 — onRatingUpdate hook", () => {
  it("is called once per updated player", () => {
    const calls: string[] = [];
    const g = new Glicko2({
      onRatingUpdate: (id) => calls.push(id),
    });
    g.createPlayer("alice");
    g.createPlayer("bob");
    g.recordMatch("alice", "bob", 1);
    g.updateRatings();
    expect(calls).toContain("alice");
    expect(calls).toContain("bob");
    expect(calls).toHaveLength(2);
  });

  it("receives prev with the old rating and next with the new one", () => {
    let capturedPrev: PlayerSnapshot | null = null;
    let capturedNext: PlayerSnapshot | null = null;
    const g = new Glicko2({
      onRatingUpdate: (id, prev, next) => {
        if (id === "alice") {
          capturedPrev = prev;
          capturedNext = next;
        }
      },
    });
    g.createPlayer("alice");
    g.createPlayer("bob");
    g.recordMatch("alice", "bob", 1);
    g.updateRatings();

    expect(capturedPrev!.rating).toBe(1500);
    expect(capturedNext!.rating).toBeGreaterThan(1500); // win → goes up
  });

  it("prev.rating ≠ next.rating after a match", () => {
    let prev: PlayerSnapshot | null = null;
    let next: PlayerSnapshot | null = null;
    const g = new Glicko2({
      onRatingUpdate: (_, p, n) => { prev = p; next = n; },
    });
    g.createPlayer("a"); g.createPlayer("b");
    g.recordMatch("a", "b", 1);
    g.updateRatings();
    expect(prev!.rating).not.toBe(next!.rating);
  });

  it("is not called when no match is recorded", () => {
    let called = false;
    const g = new Glicko2({ onRatingUpdate: () => { called = true; } });
    g.createPlayer("a");
    g.updateRatings();
    expect(called).toBe(false);
  });
});

describe("Glicko2 — applyDecay", () => {
  it("widens the RD of inactive players", () => {
    const g = new Glicko2({ ratingPeriod: 1 }); // 1 second = 1 period
    const p = g.createPlayer("alice");
    const rdBefore = p.rd;

    // Simulate 10 periods of inactivity
    const past = new Date(Date.now() - 10_000);
    p.setLastRatingPeriod(past);

    g.applyDecay();
    expect(p.rd).toBeGreaterThan(rdBefore);
  });

  it("leaves players who played recently untouched", () => {
    const g = new Glicko2({ ratingPeriod: 86400 });
    const p = g.createPlayer("alice");
    const rdBefore = p.rd;
    g.applyDecay(); // last period = now
    expect(p.rd).toBe(rdBefore);
  });
});

describe("Glicko2 — predict", () => {
  it("0.5 between two players with the same rating", () => {
    const g = new Glicko2();
    g.createPlayer("a"); g.createPlayer("b");
    expect(g.predict("a", "b")).toBeCloseTo(0.5, 5);
  });

  it("> 0.5 for the favourite", () => {
    const g = new Glicko2();
    g.createPlayer("a", 1700);
    g.createPlayer("b", 1300);
    expect(g.predict("a", "b")).toBeGreaterThan(0.5);
  });

  it("throws if player 1 does not exist", () => {
    const g = new Glicko2();
    g.createPlayer("alice");
    expect(() => g.predict("unknown", "alice")).toThrow();
  });

  it("throws if player 2 does not exist", () => {
    const g = new Glicko2();
    g.createPlayer("alice");
    expect(() => g.predict("alice", "unknown")).toThrow();
  });
});

describe("Glicko2 — getLeaderboard", () => {
  it("descending order by default", () => {
    const g = new Glicko2();
    g.createPlayer("low",  1300);
    g.createPlayer("mid",  1500);
    g.createPlayer("high", 1700);
    const board = g.getLeaderboard();
    expect(board[0]!.rating).toBeGreaterThanOrEqual(board[1]!.rating);
    expect(board[1]!.rating).toBeGreaterThanOrEqual(board[2]!.rating);
  });

  it("ascending order with descending=false", () => {
    const g = new Glicko2();
    g.createPlayer("low", 1300); g.createPlayer("high", 1700);
    const board = g.getLeaderboard(false);
    expect(board[0]!.rating).toBeLessThan(board[1]!.rating);
  });
});

describe("Glicko2 — getLeaderboardWithConfidence", () => {
  it("lowerBound < rating < upperBound", () => {
    const g = new Glicko2();
    g.createPlayer("alice");
    const [entry] = g.getLeaderboardWithConfidence();
    expect(entry!.lowerBound).toBeLessThan(entry!.player.rating);
    expect(entry!.upperBound).toBeGreaterThan(entry!.player.rating);
  });
});

describe("Glicko2 — serialize / deserialize", () => {
  it("round-trip preserves the players and their ratings", () => {
    const g = new Glicko2();
    g.createPlayer("alice", 1650, 120);
    g.createPlayer("bob",   1400, 200);
    g.recordMatch("alice", "bob", 1);

    const snapshot = g.serialize();
    const restored = Glicko2.deserialize(snapshot);

    expect(restored.getPlayer("alice")!.rating).toBeCloseTo(1650, 2);
    expect(restored.getPlayer("bob")!.rating).toBeCloseTo(1400, 2);
    expect(restored.getPendingMatchesCount()).toBe(1);
  });

  it("the restored instance computes ratings correctly", () => {
    const g = new Glicko2();
    g.createPlayer("alice");
    g.createPlayer("bob");
    g.recordMatch("alice", "bob", 1);

    const restored = Glicko2.deserialize(g.serialize());
    const updated = restored.updateRatings();

    expect(updated).toHaveLength(2);
    expect(restored.getPlayer("alice")!.rating).toBeGreaterThan(1500);
    expect(restored.getPlayer("bob")!.rating).toBeLessThan(1500);
    expect(restored.getPendingMatchesCount()).toBe(0);
  });

  it("pending matches are restored", () => {
    const g = new Glicko2();
    g.createPlayer("a"); g.createPlayer("b");
    g.recordMatch("a", "b", 0.5);
    const restored = Glicko2.deserialize(g.serialize());
    expect(restored.getPendingMatchesCount()).toBe(1);
  });
});

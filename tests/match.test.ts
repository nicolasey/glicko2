// tests/match.test.ts
import { describe, it, expect } from "bun:test";
import { Match } from "../src/calculator.ts";

describe("Match — constructeur", () => {
  it("stocke player1Id, player2Id, result", () => {
    const m = new Match("a", "b", 1);
    expect(m.player1Id).toBe("a");
    expect(m.player2Id).toBe("b");
    expect(m.result).toBe(1);
  });

  it("timestamp par défaut = maintenant (± 1 seconde)", () => {
    const before = Date.now();
    const m = new Match("a", "b", 0.5);
    const after = Date.now();
    expect(m.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(m.timestamp.getTime()).toBeLessThanOrEqual(after);
  });

  it("accepte un timestamp explicite", () => {
    const d = new Date("2024-06-01");
    const m = new Match("a", "b", 0, d);
    expect(m.timestamp).toEqual(d);
  });
});

describe("Match — reverse()", () => {
  it("inverse player1Id et player2Id", () => {
    const rev = new Match("a", "b", 1).reverse();
    expect(rev.player1Id).toBe("b");
    expect(rev.player2Id).toBe("a");
  });

  it("inverse le résultat : victoire → défaite", () => {
    expect(new Match("a", "b", 1).reverse().result).toBe(0);
  });

  it("inverse le résultat : défaite → victoire", () => {
    expect(new Match("a", "b", 0).reverse().result).toBe(1);
  });

  it("conserve 0.5 à l'inversion (match nul)", () => {
    expect(new Match("a", "b", 0.5).reverse().result).toBe(0.5);
  });

  it("conserve le timestamp", () => {
    const d = new Date("2024-01-01");
    const rev = new Match("a", "b", 1, d).reverse();
    expect(rev.timestamp).toEqual(d);
  });
});

describe("Match — fromWinner()", () => {
  it("winnerId = player1Id → result = 1", () => {
    expect(Match.fromWinner("a", "b", "a").result).toBe(1);
  });

  it("winnerId = player2Id → result = 0", () => {
    expect(Match.fromWinner("a", "b", "b").result).toBe(0);
  });

  it("winnerId = null → result = 0.5 (nul)", () => {
    expect(Match.fromWinner("a", "b", null).result).toBe(0.5);
  });
});

// tests/player.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { Player } from "../src/player.ts";
import { CONSTANTS } from "../src/types.ts";

describe("Player — construction", () => {
  it("uses the default values (1500 / 350 / 0.06)", () => {
    const p = new Player("p1");
    expect(p.rating).toBe(1500);
    expect(p.rd).toBe(350);
    expect(p.volatility).toBe(0.06);
    expect(p.id).toBe("p1");
  });

  it("accepts custom values", () => {
    const p = new Player("p2", 1800, 100, 0.04);
    expect(p.rating).toBe(1800);
    expect(p.rd).toBe(100);
    expect(p.volatility).toBe(0.04);
  });

  it("converts rating → μ (Glicko-2 scale)", () => {
    // μ = (rating - 1500) / 173.7178
    const p = new Player("p", 1800, 350, 0.06);
    expect(p.mu).toBeCloseTo((1800 - 1500) / CONSTANTS.SCALE, 5);
  });

  it("converts rd → φ (Glicko-2 scale)", () => {
    const p = new Player("p", 1500, 200, 0.06);
    expect(p.phi).toBeCloseTo(200 / CONSTANTS.SCALE, 5);
  });

  it("μ = 0 for a player at 1500", () => {
    expect(new Player("p").mu).toBe(0);
  });
});

describe("Player — updateGlicko2Values", () => {
  it("updates rating and rd through the Glicko-2 scale", () => {
    const p = new Player("p");
    // μ = 0.5 → rating = 1500 + 0.5 * 173.7178 ≈ 1586.86
    p.updateGlicko2Values(0.5, 1.0, 0.07);
    expect(p.rating).toBeCloseTo(1500 + 0.5 * CONSTANTS.SCALE, 2);
    expect(p.rd).toBeCloseTo(1.0 * CONSTANTS.SCALE, 2);
    expect(p.volatility).toBe(0.07);
  });

  it("mu and phi reflect the new internal values", () => {
    const p = new Player("p");
    p.updateGlicko2Values(1.2, 0.8, 0.05);
    expect(p.mu).toBe(1.2);
    expect(p.phi).toBe(0.8);
  });
});

describe("Player — expectedScore", () => {
  it("returns 0.5 against an equal player", () => {
    const a = new Player("a", 1500);
    const b = new Player("b", 1500);
    expect(a.expectedScore(b)).toBeCloseTo(0.5, 5);
  });

  it("returns > 0.5 against a weaker opponent", () => {
    const a = new Player("a", 1700);
    const b = new Player("b", 1300);
    expect(a.expectedScore(b)).toBeGreaterThan(0.5);
  });

  it("returns < 0.5 against a stronger opponent", () => {
    const a = new Player("a", 1300);
    const b = new Player("b", 1700);
    expect(a.expectedScore(b)).toBeLessThan(0.5);
  });

  it("is complementary: E(a,b) + E(b,a) ≈ 1", () => {
    const a = new Player("a", 1600, 150);
    const b = new Player("b", 1400, 150);
    expect(a.expectedScore(b) + b.expectedScore(a)).toBeCloseTo(1, 5);
  });
});

describe("Player — fromData / toData (serialization)", () => {
  it("lossless round-trip", () => {
    const p = new Player("x", 1650, 120, 0.055);
    const restored = Player.fromData(p.toData());
    expect(restored.id).toBe("x");
    expect(restored.rating).toBeCloseTo(1650, 2);
    expect(restored.rd).toBeCloseTo(120, 2);
    expect(restored.volatility).toBeCloseTo(0.055, 5);
  });
});

describe("Player — setLastRatingPeriod", () => {
  it("updates lastRatingPeriod", () => {
    const p = new Player("p");
    const d = new Date("2024-01-15");
    p.setLastRatingPeriod(d);
    expect(p.lastRatingPeriod).toEqual(d);
  });
});

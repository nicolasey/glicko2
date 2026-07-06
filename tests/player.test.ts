// tests/player.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { Player } from "../src/player.ts";
import { CONSTANTS } from "../src/types.ts";

describe("Player — construction", () => {
  it("utilise les valeurs par défaut (1500 / 350 / 0.06)", () => {
    const p = new Player("p1");
    expect(p.rating).toBe(1500);
    expect(p.rd).toBe(350);
    expect(p.volatility).toBe(0.06);
    expect(p.id).toBe("p1");
  });

  it("accepte des valeurs personnalisées", () => {
    const p = new Player("p2", 1800, 100, 0.04);
    expect(p.rating).toBe(1800);
    expect(p.rd).toBe(100);
    expect(p.volatility).toBe(0.04);
  });

  it("convertit rating → μ (échelle Glicko-2)", () => {
    // μ = (rating - 1500) / 173.7178
    const p = new Player("p", 1800, 350, 0.06);
    expect(p.mu).toBeCloseTo((1800 - 1500) / CONSTANTS.SCALE, 5);
  });

  it("convertit rd → φ (échelle Glicko-2)", () => {
    const p = new Player("p", 1500, 200, 0.06);
    expect(p.phi).toBeCloseTo(200 / CONSTANTS.SCALE, 5);
  });

  it("μ = 0 pour un joueur à 1500", () => {
    expect(new Player("p").mu).toBe(0);
  });
});

describe("Player — updateGlicko2Values", () => {
  it("met à jour rating et rd via l'échelle Glicko-2", () => {
    const p = new Player("p");
    // μ = 0.5 → rating = 1500 + 0.5 * 173.7178 ≈ 1586.86
    p.updateGlicko2Values(0.5, 1.0, 0.07);
    expect(p.rating).toBeCloseTo(1500 + 0.5 * CONSTANTS.SCALE, 2);
    expect(p.rd).toBeCloseTo(1.0 * CONSTANTS.SCALE, 2);
    expect(p.volatility).toBe(0.07);
  });

  it("mu et phi reflètent les nouvelles valeurs internes", () => {
    const p = new Player("p");
    p.updateGlicko2Values(1.2, 0.8, 0.05);
    expect(p.mu).toBe(1.2);
    expect(p.phi).toBe(0.8);
  });
});

describe("Player — expectedScore", () => {
  it("retourne 0.5 contre un joueur égal", () => {
    const a = new Player("a", 1500);
    const b = new Player("b", 1500);
    expect(a.expectedScore(b)).toBeCloseTo(0.5, 5);
  });

  it("retourne > 0.5 contre un adversaire plus faible", () => {
    const a = new Player("a", 1700);
    const b = new Player("b", 1300);
    expect(a.expectedScore(b)).toBeGreaterThan(0.5);
  });

  it("retourne < 0.5 contre un adversaire plus fort", () => {
    const a = new Player("a", 1300);
    const b = new Player("b", 1700);
    expect(a.expectedScore(b)).toBeLessThan(0.5);
  });

  it("est complémentaire : E(a,b) + E(b,a) ≈ 1", () => {
    const a = new Player("a", 1600, 150);
    const b = new Player("b", 1400, 200);
    expect(a.expectedScore(b) + b.expectedScore(a)).toBeCloseTo(1, 1);
  });
});

describe("Player — fromData / toData (sérialisation)", () => {
  it("round-trip sans perte", () => {
    const p = new Player("x", 1650, 120, 0.055);
    const restored = Player.fromData(p.toData());
    expect(restored.id).toBe("x");
    expect(restored.rating).toBeCloseTo(1650, 2);
    expect(restored.rd).toBeCloseTo(120, 2);
    expect(restored.volatility).toBeCloseTo(0.055, 5);
  });
});

describe("Player — setLastRatingPeriod", () => {
  it("met à jour lastRatingPeriod", () => {
    const p = new Player("p");
    const d = new Date("2024-01-15");
    p.setLastRatingPeriod(d);
    expect(p.lastRatingPeriod).toEqual(d);
  });
});

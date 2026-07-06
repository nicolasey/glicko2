// tests/calculator.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { Glicko2Calculator } from "../src/calculator.ts";
import { Player } from "../src/player.ts";

// --- Joueurs de référence (paper Glickman p.13-14) ---
const makeRefPlayers = () => {
  const player = new Player("player", 1500, 200, 0.06);
  const j1 = new Player("j1", 1400, 30,  0.06);
  const j2 = new Player("j2", 1550, 100, 0.06);
  const j3 = new Player("j3", 1700, 300, 0.06);
  return { player, j1, j2, j3 };
};

describe("Glicko2Calculator — exemple officiel Glickman", () => {
  it("nouveau rating ≈ 1464.06", () => {
    const { player, j1, j2, j3 } = makeRefPlayers();
    const calc = new Glicko2Calculator();
    const result = calc.calculateNewRating(player, [
      { opponent: j1, result: 1 },
      { opponent: j2, result: 0 },
      { opponent: j3, result: 0 },
    ]);
    expect(result.rating).toBeCloseTo(1464.06, 1);
  });

  it("nouveau RD ≈ 151.52", () => {
    const { player, j1, j2, j3 } = makeRefPlayers();
    const calc = new Glicko2Calculator();
    const result = calc.calculateNewRating(player, [
      { opponent: j1, result: 1 },
      { opponent: j2, result: 0 },
      { opponent: j3, result: 0 },
    ]);
    expect(result.rd).toBeCloseTo(151.52, 1);
  });

  it("nouvelle volatilité ≈ 0.05999 (quasi-inchangée)", () => {
    const { player, j1, j2, j3 } = makeRefPlayers();
    const calc = new Glicko2Calculator();
    const result = calc.calculateNewRating(player, [
      { opponent: j1, result: 1 },
      { opponent: j2, result: 0 },
      { opponent: j3, result: 0 },
    ]);
    expect(result.volatility).toBeCloseTo(0.05999, 4);
  });
});

describe("Glicko2Calculator — cas limite : aucun match", () => {
  it("rating inchangé sans match", () => {
    const p = new Player("p", 1500, 200, 0.06);
    const result = new Glicko2Calculator().calculateNewRating(p, []);
    expect(result.rating).toBe(1500);
  });

  it("RD augmente (incertitude croissante) sans match", () => {
    const p = new Player("p", 1500, 200, 0.06);
    const result = new Glicko2Calculator().calculateNewRating(p, []);
    // φ* = √(φ² + σ²) > φ → RD augmente
    expect(result.rd).toBeGreaterThan(200);
  });

  it("volatilité inchangée sans match", () => {
    const p = new Player("p", 1500, 200, 0.06);
    const result = new Glicko2Calculator().calculateNewRating(p, []);
    expect(result.volatility).toBe(0.06);
  });
});

describe("Glicko2Calculator — invariants de signe", () => {
  it("victoire contre plus faible → rating monte", () => {
    const strong = new Player("s", 1600, 200, 0.06);
    const weak   = new Player("w", 1400, 200, 0.06);
    const result = new Glicko2Calculator().calculateNewRating(strong, [
      { opponent: weak, result: 1 },
    ]);
    expect(result.rating).toBeGreaterThan(1600);
  });

  it("défaite contre plus faible → rating descend", () => {
    const strong = new Player("s", 1600, 200, 0.06);
    const weak   = new Player("w", 1400, 200, 0.06);
    const result = new Glicko2Calculator().calculateNewRating(strong, [
      { opponent: weak, result: 0 },
    ]);
    expect(result.rating).toBeLessThan(1600);
  });

  it("victoire surprise (outsider) → gain plus grand que victoire attendue", () => {
    const weak   = new Player("w", 1300, 200, 0.06);
    const strong = new Player("s", 1700, 200, 0.06);
    const calc = new Glicko2Calculator();

    const upsetGain = calc.calculateNewRating(weak,   [{ opponent: strong, result: 1 }]).rating - 1300;
    const normalGain = calc.calculateNewRating(strong, [{ opponent: weak,   result: 1 }]).rating - 1700;

    expect(upsetGain).toBeGreaterThan(normalGain);
  });
});

describe("Glicko2Calculator — applyRatingPeriodDecay", () => {
  it("1 période → φ' = √(φ² + σ²) > φ", () => {
    const calc = new Glicko2Calculator();
    const phi = 200 / 173.7178;
    const sigma = 0.06;
    const result = calc.applyRatingPeriodDecay(phi, sigma, 1);
    expect(result).toBeGreaterThan(phi);
    expect(result).toBeCloseTo(Math.sqrt(phi * phi + sigma * sigma), 8);
  });

  it("N périodes → φ' = √(φ² + N·σ²)", () => {
    const calc = new Glicko2Calculator();
    const phi = 1.0;
    const sigma = 0.05;
    const N = 3;
    const result = calc.applyRatingPeriodDecay(phi, sigma, N);
    expect(result).toBeCloseTo(Math.sqrt(phi * phi + N * sigma * sigma), 8);
  });
});

describe("Glicko2Calculator — predictWinProbability", () => {
  it("0.5 entre deux joueurs égaux", () => {
    const a = new Player("a", 1500);
    const b = new Player("b", 1500);
    expect(Glicko2Calculator.predictWinProbability(a, b)).toBeCloseTo(0.5, 5);
  });

  it("> 0.5 pour le joueur plus fort", () => {
    const a = new Player("a", 1700);
    const b = new Player("b", 1300);
    expect(Glicko2Calculator.predictWinProbability(a, b)).toBeGreaterThan(0.5);
  });

  it("prob(a,b) + prob(b,a) ≈ 1", () => {
    const a = new Player("a", 1650, 150);
    const b = new Player("b", 1350, 150);
    const pAB = Glicko2Calculator.predictWinProbability(a, b);
    const pBA = Glicko2Calculator.predictWinProbability(b, a);
    expect(pAB + pBA).toBeCloseTo(1, 5);
  });
});

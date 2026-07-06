# Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Couvrir l'intégralité du package glicko2 avec des tests bun:test qui vérifient la correction mathématique, le comportement des APIs publiques, et le hook d'extension.

**Architecture:** Quatre fichiers de test isolés correspondant aux quatre modules source (`Player`, `Glicko2Calculator`, `Match`, `Glicko2`). Chaque fichier teste une seule responsabilité. Les valeurs numériques attendues sont calculées à partir du paper de Glickman (exemple officiel page 13-14) et servent de référence absolue pour le moteur de calcul.

**Tech Stack:** Bun, bun:test (`describe`, `it`, `expect`, `beforeEach`), TypeScript strict.

## Global Constraints

- Runner : `bun test` uniquement — pas de jest, vitest, ou autre
- Pas de mocks ni de stubs — tests sur implémentations réelles
- Tolérance flottante : `toBeCloseTo(value, 2)` (2 décimales) sauf mention contraire
- Fichiers de test dans `tests/` à la racine du projet
- Imports avec extension `.ts` explicite (requis par tsconfig `allowImportingTsExtensions`)
- Aucun fichier source ne doit être modifié

---

### Task 1: Player — construction, getters, conversion d'échelle

**Files:**
- Create: `tests/player.test.ts`

**Interfaces:**
- Consumes: `src/player.ts` — `Player`, `src/types.ts` — `CONSTANTS`
- Produces: suite de référence pour les valeurs μ/φ utilisées dans les tâches suivantes

- [ ] **Step 1: Écrire les tests**

```typescript
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
    expect(a.expectedScore(b) + b.expectedScore(a)).toBeCloseTo(1, 5);
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
```

- [ ] **Step 2: Vérifier que les tests échouent (module non importé)**

```bash
bun test tests/player.test.ts
```

Si Bun trouve le fichier et les imports, les tests passeront directement — c'est attendu pour les tests de construction. Continuer.

- [ ] **Step 3: Lancer tous les tests player et vérifier le résultat**

```bash
bun test tests/player.test.ts --reporter=verbose
```

Résultat attendu : tous les `describe` passent (≥ 12 tests verts).

- [ ] **Step 4: Commit**

```bash
git add tests/player.test.ts
git commit -m "test: Player — construction, scale conversion, expectedScore, serialization"
```

---

### Task 2: Match — création, inversion, fromWinner

**Files:**
- Create: `tests/match.test.ts`

**Interfaces:**
- Consumes: `src/calculator.ts` — `Match`
- Produces: rien (utilitaire pur, pas de dépendances aval dans les tests)

- [ ] **Step 1: Écrire les tests**

```typescript
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
```

- [ ] **Step 2: Lancer les tests**

```bash
bun test tests/match.test.ts --reporter=verbose
```

Résultat attendu : tous les tests passent (≥ 8 tests verts).

- [ ] **Step 3: Commit**

```bash
git add tests/match.test.ts
git commit -m "test: Match — constructor, reverse, fromWinner"
```

---

### Task 3: Glicko2Calculator — valeurs de référence Glickman

**Files:**
- Create: `tests/calculator.test.ts`

**Interfaces:**
- Consumes: `src/calculator.ts` — `Glicko2Calculator`, `src/player.ts` — `Player`
- Produces: validation mathématique du moteur de calcul

**Référence:** Exemple officiel de Glickman (http://www.glicko.net/glicko/glicko2.pdf, p.13-14).

Joueur r = 1500, RD = 200, σ = 0.06.
Adversaires :
- j1: r=1400, RD=30,  s=1 (victoire)
- j2: r=1550, RD=100, s=0 (défaite)
- j3: r=1700, RD=300, s=0 (défaite)

Résultats attendus après une période :
- Nouveau rating : 1464.06
- Nouveau RD : 151.52
- Nouvelle volatilité : 0.05999 (quasi-inchangée)

- [ ] **Step 1: Écrire les tests**

```typescript
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
    const a = new Player("a", 1650, 100);
    const b = new Player("b", 1350, 200);
    const pAB = Glicko2Calculator.predictWinProbability(a, b);
    const pBA = Glicko2Calculator.predictWinProbability(b, a);
    expect(pAB + pBA).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: Lancer les tests**

```bash
bun test tests/calculator.test.ts --reporter=verbose
```

Résultat attendu : tous les tests passent (≥ 15 tests verts). Le test "exemple officiel Glickman" est la vérification mathématique critique — s'il échoue, le moteur est incorrect.

- [ ] **Step 3: Commit**

```bash
git add tests/calculator.test.ts
git commit -m "test: Glicko2Calculator — référence Glickman, invariants, decay, predict"
```

---

### Task 4: Glicko2 — API publique, flux complet, hook onRatingUpdate

**Files:**
- Create: `tests/glicko2.test.ts`

**Interfaces:**
- Consumes: `src/glicko2.ts` — `Glicko2`, `src/types.ts` — `PlayerSnapshot`
- Produces: couverture de l'API orchestrateur complète

- [ ] **Step 1: Écrire les tests**

```typescript
// tests/glicko2.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { Glicko2 } from "../src/glicko2.ts";
import type { PlayerSnapshot } from "../src/glicko2.ts";

describe("Glicko2 — gestion des joueurs", () => {
  let g: Glicko2;
  beforeEach(() => { g = new Glicko2(); });

  it("createPlayer crée un joueur avec les valeurs par défaut", () => {
    const p = g.createPlayer("alice");
    expect(p.id).toBe("alice");
    expect(p.rating).toBe(1500);
    expect(p.rd).toBe(350);
  });

  it("createPlayer avec valeurs personnalisées", () => {
    const p = g.createPlayer("bob", 1800, 100, 0.04);
    expect(p.rating).toBe(1800);
    expect(p.rd).toBe(100);
  });

  it("createPlayer lance une erreur si l'ID existe déjà", () => {
    g.createPlayer("alice");
    expect(() => g.createPlayer("alice")).toThrow();
  });

  it("getPlayer retourne le joueur ou undefined", () => {
    g.createPlayer("alice");
    expect(g.getPlayer("alice")).toBeDefined();
    expect(g.getPlayer("ghost")).toBeUndefined();
  });

  it("removePlayer supprime le joueur", () => {
    g.createPlayer("alice");
    expect(g.removePlayer("alice")).toBe(true);
    expect(g.getPlayer("alice")).toBeUndefined();
  });

  it("removePlayer retourne false si le joueur n'existe pas", () => {
    expect(g.removePlayer("ghost")).toBe(false);
  });

  it("getAllPlayers retourne tous les joueurs", () => {
    g.createPlayer("a");
    g.createPlayer("b");
    expect(g.getAllPlayers()).toHaveLength(2);
  });
});

describe("Glicko2 — enregistrement des matchs", () => {
  let g: Glicko2;
  beforeEach(() => {
    g = new Glicko2();
    g.createPlayer("a");
    g.createPlayer("b");
  });

  it("recordMatch incrémente getPendingMatchesCount", () => {
    g.recordMatch("a", "b", 1);
    expect(g.getPendingMatchesCount()).toBe(1);
  });

  it("recordMatchWithWinner avec gagnant", () => {
    g.recordMatchWithWinner("a", "b", "a");
    expect(g.getPendingMatchesCount()).toBe(1);
  });

  it("recordMatchWithWinner avec nul (null)", () => {
    g.recordMatchWithWinner("a", "b", null);
    expect(g.getPendingMatchesCount()).toBe(1);
  });

  it("clearPendingMatches vide la file", () => {
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

  it("retourne un tableau vide s'il n'y a aucun match en attente", () => {
    expect(g.updateRatings()).toHaveLength(0);
  });

  it("retourne les joueurs mis à jour", () => {
    g.recordMatch("alice", "bob", 1);
    const updated = g.updateRatings();
    expect(updated.length).toBeGreaterThan(0);
  });

  it("vide les matchs en attente après updateRatings", () => {
    g.recordMatch("alice", "bob", 1);
    g.updateRatings();
    expect(g.getPendingMatchesCount()).toBe(0);
  });

  it("victoire → alice monte, bob descend", () => {
    const ratingAliceBefore = g.getPlayer("alice")!.rating;
    const ratingBobBefore   = g.getPlayer("bob")!.rating;
    g.recordMatch("alice", "bob", 1);
    g.updateRatings();
    expect(g.getPlayer("alice")!.rating).toBeGreaterThan(ratingAliceBefore);
    expect(g.getPlayer("bob")!.rating).toBeLessThan(ratingBobBefore);
  });

  it("nul → ratings proches des valeurs initiales (≤ 20 points d'écart)", () => {
    g.recordMatch("alice", "bob", 0.5);
    g.updateRatings();
    expect(Math.abs(g.getPlayer("alice")!.rating - 1500)).toBeLessThan(20);
    expect(Math.abs(g.getPlayer("bob")!.rating - 1500)).toBeLessThan(20);
  });
});

describe("Glicko2 — onRatingUpdate hook", () => {
  it("est appelé une fois par joueur mis à jour", () => {
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

  it("reçoit prev avec l'ancien rating et next avec le nouveau", () => {
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
    expect(capturedNext!.rating).toBeGreaterThan(1500); // victoire → monte
  });

  it("prev.rating ≠ next.rating après un match", () => {
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

  it("n'est pas appelé si aucun match n'est enregistré", () => {
    let called = false;
    const g = new Glicko2({ onRatingUpdate: () => { called = true; } });
    g.createPlayer("a");
    g.updateRatings();
    expect(called).toBe(false);
  });
});

describe("Glicko2 — applyDecay", () => {
  it("augmente le RD des joueurs inactifs", () => {
    const g = new Glicko2({ ratingPeriod: 1 }); // 1 seconde = 1 période
    const p = g.createPlayer("alice");
    const rdBefore = p.rd;

    // Simuler une inactivité de 10 périodes
    const past = new Date(Date.now() - 10_000);
    p.setLastRatingPeriod(past);

    g.applyDecay();
    expect(p.rd).toBeGreaterThan(rdBefore);
  });

  it("ne modifie pas les joueurs ayant joué récemment", () => {
    const g = new Glicko2({ ratingPeriod: 86400 });
    const p = g.createPlayer("alice");
    const rdBefore = p.rd;
    g.applyDecay(); // dernière période = maintenant
    expect(p.rd).toBe(rdBefore);
  });
});

describe("Glicko2 — predict", () => {
  it("0.5 entre deux joueurs à rating identique", () => {
    const g = new Glicko2();
    g.createPlayer("a"); g.createPlayer("b");
    expect(g.predict("a", "b")).toBeCloseTo(0.5, 5);
  });

  it("> 0.5 pour le favori", () => {
    const g = new Glicko2();
    g.createPlayer("a", 1700);
    g.createPlayer("b", 1300);
    expect(g.predict("a", "b")).toBeGreaterThan(0.5);
  });
});

describe("Glicko2 — getLeaderboard", () => {
  it("tri décroissant par défaut", () => {
    const g = new Glicko2();
    g.createPlayer("low",  1300);
    g.createPlayer("mid",  1500);
    g.createPlayer("high", 1700);
    const board = g.getLeaderboard();
    expect(board[0]!.rating).toBeGreaterThanOrEqual(board[1]!.rating);
    expect(board[1]!.rating).toBeGreaterThanOrEqual(board[2]!.rating);
  });

  it("tri croissant avec descending=false", () => {
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
  it("round-trip préserve les joueurs et leurs ratings", () => {
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

  it("les matchs en attente sont restaurés", () => {
    const g = new Glicko2();
    g.createPlayer("a"); g.createPlayer("b");
    g.recordMatch("a", "b", 0.5);
    const restored = Glicko2.deserialize(g.serialize());
    expect(restored.getPendingMatchesCount()).toBe(1);
  });
});
```

- [ ] **Step 2: Lancer les tests**

```bash
bun test tests/glicko2.test.ts --reporter=verbose
```

Résultat attendu : tous les tests passent (≥ 25 tests verts).

- [ ] **Step 3: Commit**

```bash
git add tests/glicko2.test.ts
git commit -m "test: Glicko2 — public API, updateRatings, hook, decay, predict, leaderboard, serialize"
```

---

### Task 5: Vérification finale et script test global

**Files:**
- Modify: `package.json` — vérifier que `"test": "bun test"` couvre `tests/`

**Interfaces:**
- Consumes: tous les fichiers de test des tâches 1–4
- Produces: confirmation que `bun test` lance tout

- [ ] **Step 1: Lancer la suite complète**

```bash
bun test --reporter=verbose
```

Résultat attendu : 4 suites, ≥ 60 tests verts, 0 échec.

- [ ] **Step 2: Vérifier la couverture globale (optionnel)**

```bash
bun test --coverage
```

Cibles attendues : `src/player.ts` ≥ 95%, `src/calculator.ts` ≥ 90%, `src/glicko2.ts` ≥ 90%.

- [ ] **Step 3: Commit final**

```bash
git add .
git commit -m "test: suite complète — player, match, calculator, glicko2"
```

---

## Auto-review

### Couverture spec

| Module | Méthodes publiques | Couverte |
|---|---|---|
| `Player` | constructor, fromData, rating/rd/volatility getters, mu/phi, expectedScore, updateGlicko2Values, toData, setLastRatingPeriod | ✅ Task 1 |
| `Match` | constructor, reverse, fromWinner | ✅ Task 2 |
| `Glicko2Calculator` | calculateNewRating (ref Glickman), cas 0 match, applyRatingPeriodDecay, predictWinProbability | ✅ Task 3 |
| `Glicko2` | createPlayer, getPlayer, removePlayer, getAllPlayers, recordMatch, recordMatchWithWinner, updateRatings, applyDecay, predict, getLeaderboard, getLeaderboardWithConfidence, serialize, deserialize, clearPendingMatches, getPendingMatchesCount | ✅ Task 4 |
| `onRatingUpdate` hook | appelé, reçoit prev/next corrects, non appelé sans match | ✅ Task 4 |

### Éléments non testés (intentionnels — YAGNI)

- `toString()` sur `Player` — affichage pur, aucun invariant métier
- `CONSTANTS` — valeurs statiques, testées indirectement via Player et Calculator
- `DEFAULT_CONFIG` — testé indirectement via Glicko2 sans config

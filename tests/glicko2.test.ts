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

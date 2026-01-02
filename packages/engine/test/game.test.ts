import { describe, expect, it } from "vitest";
import { createGameState, reduceGame } from "../src/index";
import type { Card, Suit } from "../src/index";

const card = (suit: Suit, rank: Card["rank"]): Card => ({ suit, rank });

describe("trump reveal action", () => {
  it("allows a player to reveal trump when void in the lead suit", () => {
    const base = createGameState({ seed: 7, trumpSuit: "spades" });
    const state = {
      ...base,
      currentPlayer: 0,
      trumpRevealed: false,
      trick: { plays: [{ player: 1, card: card("hearts", "7") }] },
      hands: [[card("spades", "7"), card("clubs", "A")], ...base.hands.slice(1)],
    };

    const next = reduceGame(state, { type: "revealTrump", player: 0 });

    expect(next.trumpRevealed).toBe(true);
    expect(next.log.at(-1)).toContain("Trump revealed");
  });

  it("ignores reveal requests when the player can follow suit", () => {
    const base = createGameState({ seed: 11, trumpSuit: "spades" });
    const state = {
      ...base,
      currentPlayer: 0,
      trumpRevealed: false,
      trick: { plays: [{ player: 2, card: card("hearts", "9") }] },
      hands: [[card("hearts", "A"), card("spades", "7")], ...base.hands.slice(1)],
    };

    const next = reduceGame(state, { type: "revealTrump", player: 0 });

    expect(next.trumpRevealed).toBe(false);
  });
});

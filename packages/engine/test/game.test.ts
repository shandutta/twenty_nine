import { describe, expect, it } from "vitest";
import { MATCH_PIPS, createDeck, createGameState, reduceGame, shuffleDeck } from "../src/index";
import type { Card, Suit } from "../src/index";

const card = (suit: Suit, rank: Card["rank"]): Card => ({ suit, rank });

describe("trump reveal action", () => {
  it("allows a player to reveal trump when void in the lead suit", () => {
    const base = createGameState({ seed: 7, trumpSuit: "spades", phase: "playing" });
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
    const base = createGameState({ seed: 11, trumpSuit: "spades", phase: "playing" });
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

describe("trump selection", () => {
  it("lets the bidder set trump from the 7th card", () => {
    const seed = 12345;
    const deck = shuffleDeck(createDeck(), seed);
    const base = createGameState({ seed, phase: "choose-trump", bidderPlayer: 1, bidTarget: 16 });

    const next = reduceGame(base, { type: "chooseTrumpFromSeventh", player: 1 });

    expect(next.trumpSuit).toBe(deck[6].suit);
    expect(next.trumpRevealed).toBe(false);
    expect(next.trumpFromSeventh).toBe(true);
    expect(next.phase).toBe("playing");
  });
});

describe("match pips", () => {
  it("awards a red pip to the bidder team when they make the bid", () => {
    const base = createGameState({
      seed: 3,
      phase: "playing",
      bidTarget: 16,
      bidderPlayer: 1,
      bidderTeam: 1,
      trumpSuit: "spades",
    });
    const state = {
      ...base,
      points: [0, 15] as [number, number],
      trickNumber: 7,
      currentPlayer: 0,
      trick: {
        plays: [
          { player: 1, card: card("hearts", "7") },
          { player: 2, card: card("hearts", "8") },
          { player: 3, card: card("hearts", "9") },
        ],
      },
      hands: [[card("hearts", "A")], [], [], []],
    };

    const next = reduceGame(state, { type: "playCard", player: 0, card: card("hearts", "A") });

    expect(next.phase).toBe("hand-complete");
    expect(next.matchRound).toBe(state.matchRound + 1);
    expect(next.matchRedPips[1]).toBe(1);
    expect(next.matchBlackPips[1]).toBe(0);
    expect(next.matchWinner).toBeNull();
  });

  it("ends the match when a team reaches six black pips", () => {
    const base = createGameState({
      seed: 9,
      phase: "playing",
      bidTarget: 16,
      bidderPlayer: 0,
      bidderTeam: 0,
      trumpSuit: "spades",
    });
    const state = {
      ...base,
      points: [10, 12] as [number, number],
      matchBlackPips: [MATCH_PIPS - 1, 0] as [number, number],
      trickNumber: 7,
      currentPlayer: 0,
      trick: {
        plays: [
          { player: 1, card: card("hearts", "7") },
          { player: 2, card: card("hearts", "8") },
          { player: 3, card: card("hearts", "9") },
        ],
      },
      hands: [[card("hearts", "A")], [], [], []],
    };

    const next = reduceGame(state, { type: "playCard", player: 0, card: card("hearts", "A") });

    expect(next.phase).toBe("hand-complete");
    expect(next.matchBlackPips[0]).toBe(MATCH_PIPS);
    expect(next.matchWinner).toBe(1);
    expect(next.matchEndReason).toBe("black");
  });
});

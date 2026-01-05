import { describe, expect, it } from "vitest";
import {
  MATCH_PIPS,
  cardPoints,
  chooseBotCard,
  createDeck,
  createGameState,
  reduceGame,
  shuffleDeck,
} from "../src/index";
import type { Card, GameAction, Suit } from "../src/index";

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

describe("game setup", () => {
  it("treats no-trump as revealed when the hand starts playing", () => {
    const state = createGameState({ seed: 21, phase: "playing", trumpSuit: null, bidTarget: 16 });
    expect(state.trumpRevealed).toBe(true);
    expect(state.trumpSuit).toBeNull();
  });

  it("starts a new hand only after completion", () => {
    const bidding = createGameState({ seed: 5, phase: "bidding" });
    const ignored = reduceGame(bidding, { type: "startNextHand" });
    expect(ignored).toBe(bidding);

    const complete = createGameState({ seed: 5, phase: "hand-complete", bidTarget: 16, trumpSuit: "hearts" });
    const restarted = reduceGame(complete, { type: "startNextHand" });
    expect(restarted).not.toBe(complete);
    expect(restarted.seed).toBe(complete.seed + 1);
    expect(restarted.dealer).toBe((complete.dealer + 1) % 4);
    expect(restarted.phase).toBe("bidding");
  });

  it("defaults trump to the top of the shuffled deck when omitted", () => {
    const seed = 77;
    const deck = shuffleDeck(createDeck(), seed);
    const state = createGameState({ seed, phase: "playing", bidTarget: 16, bidderPlayer: 0, bidderTeam: 0 });
    expect(state.trumpSuit).toBe(deck[0].suit);
  });

  it("deals remaining cards even when fewer than expected are left", () => {
    const base = createGameState({ seed: 78, phase: "choose-trump", bidderPlayer: 1, bidTarget: 16 });
    const state = { ...base, undealt: base.undealt.slice(0, 3) };

    const next = reduceGame(state, { type: "chooseTrump", player: base.currentPlayer, suit: "hearts" });

    expect(next.undealt.length).toBe(0);
    expect(next.hands.flat().length).toBe(base.hands.flat().length + 3);
  });

  it("marks the hand complete when no undealt cards remain", () => {
    const base = createGameState({ seed: 79, phase: "choose-trump", bidderPlayer: 1, bidTarget: 16 });
    const state = { ...base, undealt: [] };

    const next = reduceGame(state, { type: "chooseTrump", player: base.currentPlayer, suit: "clubs" });

    expect(next.log).toContain("Hand complete.");
    expect(next.undealt.length).toBe(0);
  });
});

describe("guard clauses", () => {
  it("returns early when a match winner is already decided", () => {
    const state = createGameState({ seed: 30, matchWinner: 1, matchEndReason: "black" });
    const next = reduceGame(state, { type: "placeBid", player: 1, amount: 16 });
    expect(next).toBe(state);
  });

  it("ignores bids in the wrong phase, by the wrong player, or above max", () => {
    const playing = createGameState({ seed: 31, phase: "playing", trumpSuit: "spades", bidTarget: 16 });
    expect(reduceGame(playing, { type: "placeBid", player: 0, amount: 16 })).toBe(playing);

    const bidding = createGameState({ seed: 32, dealer: 0 });
    const wrongPlayer = reduceGame(bidding, { type: "placeBid", player: 2, amount: 16 });
    expect(wrongPlayer).toBe(bidding);

    const tooHigh = reduceGame(bidding, { type: "placeBid", player: bidding.currentPlayer, amount: 30 });
    expect(tooHigh).toBe(bidding);
  });

  it("ignores passes in the wrong phase or by the wrong player", () => {
    const playing = createGameState({ seed: 33, phase: "playing", trumpSuit: "spades", bidTarget: 16 });
    expect(reduceGame(playing, { type: "passBid", player: 0 })).toBe(playing);

    const bidding = createGameState({ seed: 34, dealer: 0 });
    const wrongPlayer = reduceGame(bidding, { type: "passBid", player: 3 });
    expect(wrongPlayer).toBe(bidding);
  });

  it("ignores trump selection when bidding data is incomplete", () => {
    const chooseTrumpState = createGameState({ seed: 35, phase: "choose-trump", bidTarget: 16 });
    const next = reduceGame(chooseTrumpState, {
      type: "chooseTrump",
      player: chooseTrumpState.currentPlayer,
      suit: "hearts",
    });
    expect(next).toBe(chooseTrumpState);

    const seventhState = createGameState({ seed: 36, phase: "choose-trump", bidTarget: 16 });
    const seventh = reduceGame(seventhState, { type: "chooseTrumpFromSeventh", player: seventhState.currentPlayer });
    expect(seventh).toBe(seventhState);
  });

  it("ignores trump selection outside the choose-trump phase or by the wrong player", () => {
    const bidding = createGameState({ seed: 46, phase: "bidding" });
    expect(reduceGame(bidding, { type: "chooseTrumpFromSeventh", player: 0 })).toBe(bidding);

    const choosing = createGameState({ seed: 47, phase: "choose-trump", bidderPlayer: 1, bidTarget: 16 });
    const wrongPlayer = (choosing.currentPlayer + 1) % 4;
    expect(reduceGame(choosing, { type: "chooseTrump", player: wrongPlayer, suit: "hearts" })).toBe(choosing);
  });

  it("accepts a no-trump choice and reveals immediately", () => {
    const choosing = createGameState({ seed: 48, phase: "choose-trump", bidderPlayer: 1, bidTarget: 16 });
    const next = reduceGame(choosing, { type: "chooseTrump", player: choosing.currentPlayer, suit: null });
    expect(next.trumpSuit).toBeNull();
    expect(next.trumpRevealed).toBe(true);
  });

  it("ignores chooseTrump outside the choose-trump phase", () => {
    const bidding = createGameState({ seed: 49, phase: "bidding" });
    expect(reduceGame(bidding, { type: "chooseTrump", player: 0, suit: "hearts" })).toBe(bidding);
  });

  it("ignores chooseTrumpFromSeventh when not the current player", () => {
    const choosing = createGameState({ seed: 50, phase: "choose-trump", bidderPlayer: 1, bidTarget: 16 });
    const wrongPlayer = (choosing.currentPlayer + 1) % 4;
    expect(reduceGame(choosing, { type: "chooseTrumpFromSeventh", player: wrongPlayer })).toBe(choosing);
  });

  it("ignores royals declarations that fail preconditions", () => {
    const base = createGameState({
      seed: 37,
      phase: "playing",
      bidTarget: 16,
      bidderPlayer: 0,
      bidderTeam: 0,
      trumpSuit: "spades",
    });

    const wrongPhase = createGameState({ seed: 38, phase: "choose-trump", bidTarget: 16, trumpSuit: "spades" });
    expect(reduceGame(wrongPhase, { type: "declareRoyals", player: wrongPhase.currentPlayer })).toBe(wrongPhase);

    const noTrump = { ...base, trumpSuit: null };
    expect(reduceGame(noTrump, { type: "declareRoyals", player: 0 })).toBe(noTrump);

    const notRevealed = { ...base, trumpRevealed: false };
    expect(reduceGame(notRevealed, { type: "declareRoyals", player: 0 })).toBe(notRevealed);

    const noLastTrick = { ...base, lastTrickWinnerTeam: null };
    expect(reduceGame(noLastTrick, { type: "declareRoyals", player: 0 })).toBe(noLastTrick);

    const alreadyDeclared = { ...base, trumpRevealed: true, lastTrickWinnerTeam: 0, royalsDeclaredBy: 0 };
    expect(reduceGame(alreadyDeclared, { type: "declareRoyals", player: 0 })).toBe(alreadyDeclared);

    const wrongTeam = { ...base, trumpRevealed: true, lastTrickWinnerTeam: 1 };
    expect(reduceGame(wrongTeam, { type: "declareRoyals", player: 0 })).toBe(wrongTeam);
  });

  it("ignores trump reveal requests that fail preconditions", () => {
    const base = createGameState({ seed: 39, phase: "playing", trumpSuit: "spades", bidTarget: 16 });

    const wrongPhase = createGameState({ seed: 40, phase: "bidding" });
    expect(reduceGame(wrongPhase, { type: "revealTrump", player: 0 })).toBe(wrongPhase);

    const noTrump = { ...base, trumpSuit: null };
    expect(reduceGame(noTrump, { type: "revealTrump", player: base.currentPlayer })).toBe(noTrump);

    const alreadyRevealed = { ...base, trumpRevealed: true };
    expect(reduceGame(alreadyRevealed, { type: "revealTrump", player: base.currentPlayer })).toBe(alreadyRevealed);

    const wrongPlayer = { ...base, currentPlayer: 1 };
    expect(reduceGame(wrongPlayer, { type: "revealTrump", player: 0 })).toBe(wrongPlayer);
  });

  it("returns state for unknown action types", () => {
    const state = createGameState({ seed: 43 });
    const action = { type: "noop" } as unknown as GameAction;
    expect(reduceGame(state, action)).toBe(state);
  });
});

describe("bot choices", () => {
  it("prefers the lowest point, lowest ranked legal card", () => {
    const hand = [card("hearts", "7"), card("hearts", "K"), card("hearts", "9")];
    const trick = { plays: [] };
    const chosen = chooseBotCard({ hand, trick });
    expect(chosen).toEqual(card("hearts", "7"));
  });

  it("returns the only legal card when forced to follow suit", () => {
    const hand = [card("hearts", "7"), card("spades", "A")];
    const trick = { plays: [{ player: 1, card: card("hearts", "9") }] };
    const chosen = chooseBotCard({ hand, trick });
    expect(chosen).toEqual(card("hearts", "7"));
  });

  it("handles rank ties when point values are equal", () => {
    const hand = [card("clubs", "8"), card("spades", "8")];
    const trick = { plays: [] };
    const chosen = chooseBotCard({ hand, trick });
    expect([hand[0], hand[1]]).toContainEqual(chosen);
  });
});

describe("bidding validation", () => {
  it("ignores bids below the minimum or below the current raise", () => {
    const state = createGameState({ seed: 10, dealer: 0 });
    const tooLow = reduceGame(state, { type: "placeBid", player: 1, amount: 15 });
    expect(tooLow).toBe(state);

    const raised = reduceGame(state, { type: "placeBid", player: 1, amount: 16 });
    const invalidRaise = reduceGame(raised, { type: "placeBid", player: 2, amount: 16 });
    expect(invalidRaise).toBe(raised);
  });

  it("jumps to trump selection when the max bid is placed", () => {
    const state = createGameState({ seed: 15, dealer: 0 });
    const maxBid = reduceGame(state, { type: "placeBid", player: 1, amount: 29 });
    expect(maxBid.phase).toBe("choose-trump");
    expect(maxBid.currentPlayer).toBe(1);
    expect(maxBid.bidTarget).toBe(29);
  });
});

describe("royals flow", () => {
  it("updates the bid target when royals are declared", () => {
    const base = createGameState({
      seed: 17,
      phase: "playing",
      bidTarget: 20,
      bidderPlayer: 0,
      bidderTeam: 0,
      trumpSuit: "spades",
    });
    const state = {
      ...base,
      trumpRevealed: true,
      lastTrickWinnerTeam: 0,
      hands: [[card("spades", "K"), card("spades", "Q")], ...base.hands.slice(1)],
    };

    const next = reduceGame(state, { type: "declareRoyals", player: 0 });
    expect(next.bidTarget).toBe(16);
    expect(next.royalsDeclaredBy).toBe(0);
    expect(next.log.at(-1)).toContain("Royals declared");
  });
});

describe("trump reveal rules", () => {
  it("ignores reveal requests when trump comes from the seventh card", () => {
    const base = createGameState({ seed: 19, trumpSuit: "spades", phase: "playing" });
    const state = {
      ...base,
      currentPlayer: 0,
      trumpRevealed: false,
      trumpFromSeventh: true,
      trick: { plays: [{ player: 1, card: card("hearts", "7") }] },
      hands: [[card("clubs", "A")], ...base.hands.slice(1)],
    };

    const next = reduceGame(state, { type: "revealTrump", player: 0 });
    expect(next.trumpRevealed).toBe(false);
  });

  it("uses an empty hand fallback when player hand data is missing", () => {
    const base = createGameState({ seed: 45, trumpSuit: "spades", phase: "playing", bidTarget: 16 });
    const state = {
      ...base,
      hands: [],
      currentPlayer: 0,
      trumpRevealed: false,
      trick: { plays: [{ player: 1, card: card("hearts", "7") }] },
    };

    const next = reduceGame(state, { type: "revealTrump", player: 0 });

    expect(next.trumpRevealed).toBe(true);
  });
});

describe("play validation", () => {
  it("throws when trying to play outside of the playing phase", () => {
    const state = createGameState({ seed: 24, phase: "bidding" });
    const action = { type: "playCard" as const, player: state.currentPlayer, card: state.hands[0][0] };
    expect(() => reduceGame(state, action)).toThrow("Hand is not in play");
  });

  it("throws when a player acts out of turn", () => {
    const state = createGameState({ seed: 25, phase: "playing", trumpSuit: "spades", bidTarget: 16 });
    const action = { type: "playCard" as const, player: (state.currentPlayer + 1) % 4, card: state.hands[0][0] };
    expect(() => reduceGame(state, action)).toThrow("Not this player's turn");
  });

  it("throws when a card is not in the player's hand", () => {
    const state = createGameState({ seed: 26, phase: "playing", trumpSuit: "spades", bidTarget: 16 });
    const hand = state.hands[state.currentPlayer];
    const missing = createDeck().find(
      (candidate) => !hand.some((owned) => owned.suit === candidate.suit && owned.rank === candidate.rank)
    );
    expect(missing).toBeTruthy();
    const action = { type: "playCard" as const, player: state.currentPlayer, card: missing! };
    expect(() => reduceGame(state, action)).toThrow("Card not found");
  });
});

describe("trick progression", () => {
  it("logs a trump reveal when a void player plays off-suit mid-trick", () => {
    const base = createGameState({
      seed: 41,
      phase: "playing",
      bidTarget: 16,
      bidderPlayer: 0,
      bidderTeam: 0,
      trumpSuit: "spades",
    });
    const state = {
      ...base,
      trumpRevealed: false,
      currentPlayer: 0,
      trick: { plays: [{ player: 1, card: card("hearts", "7") }] },
      hands: [[card("spades", "A")], ...base.hands.slice(1)],
    };

    const next = reduceGame(state, { type: "playCard", player: 0, card: card("spades", "A") });

    expect(next.trumpRevealed).toBe(true);
    expect(next.trick.plays).toHaveLength(2);
    expect(next.log).toContain("Trump revealed.");
    expect(next.currentPlayer).toBe(1);
  });

  it("completes a non-final trick without ending the hand", () => {
    const base = createGameState({
      seed: 44,
      phase: "playing",
      bidTarget: 16,
      bidderPlayer: 0,
      bidderTeam: 0,
      trumpSuit: "spades",
    });
    const state = {
      ...base,
      points: [0, 0] as [number, number],
      trickNumber: 0,
      currentPlayer: 0,
      trick: {
        plays: [
          { player: 1, card: card("hearts", "7") },
          { player: 2, card: card("hearts", "8") },
          { player: 3, card: card("hearts", "9") },
        ],
      },
      hands: [[card("hearts", "J")], [], [], []],
    };

    const next = reduceGame(state, { type: "playCard", player: 0, card: card("hearts", "J") });

    const expected = cardPoints(card("hearts", "J")) + cardPoints(card("hearts", "9"));
    expect(next.phase).toBe("playing");
    expect(next.trickNumber).toBe(1);
    expect(next.matchRound).toBe(state.matchRound);
    expect(next.points[0]).toBe(expected);
  });

  it("skips match pip updates when there is no bidder team", () => {
    const base = createGameState({
      seed: 42,
      phase: "playing",
      trumpSuit: "spades",
      bidderPlayer: null,
      bidderTeam: null,
    });
    const state = {
      ...base,
      points: [10, 12] as [number, number],
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
    expect(next.matchRedPips).toEqual(state.matchRedPips);
    expect(next.matchBlackPips).toEqual(state.matchBlackPips);
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
          { player: 3, card: card("hearts", "J") },
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

  it("awards the opposing team when bidder team 2 hits black pips", () => {
    const base = createGameState({
      seed: 14,
      phase: "playing",
      bidTarget: 16,
      bidderPlayer: 1,
      bidderTeam: 1,
      trumpSuit: "spades",
    });
    const state = {
      ...base,
      points: [12, 10] as [number, number],
      matchBlackPips: [0, MATCH_PIPS - 1] as [number, number],
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

    expect(next.matchBlackPips[1]).toBe(MATCH_PIPS);
    expect(next.matchWinner).toBe(0);
    expect(next.matchEndReason).toBe("black");
  });

  it("ends the match when a team reaches six red pips", () => {
    const base = createGameState({
      seed: 13,
      phase: "playing",
      bidTarget: 16,
      bidderPlayer: 0,
      bidderTeam: 0,
      trumpSuit: "spades",
    });
    const state = {
      ...base,
      points: [15, 12] as [number, number],
      matchRedPips: [MATCH_PIPS - 1, 0] as [number, number],
      trickNumber: 7,
      currentPlayer: 0,
      trick: {
        plays: [
          { player: 1, card: card("hearts", "7") },
          { player: 2, card: card("hearts", "8") },
          { player: 3, card: card("hearts", "9") },
        ],
      },
      hands: [[card("hearts", "J")], [], [], []],
    };

    const next = reduceGame(state, { type: "playCard", player: 0, card: card("hearts", "J") });
    expect(next.matchRedPips[0]).toBe(MATCH_PIPS);
    expect(next.matchWinner).toBe(0);
    expect(next.matchEndReason).toBe("red");
  });
});

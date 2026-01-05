import { describe, expect, it } from "vitest";
import {
  createDeck,
  getLegalPlays,
  isLegalPlay,
  leadSuit,
  playCard,
  scoreTrick,
  shouldRevealTrump,
  trickPoints,
  winningPlay,
} from "../src/index";
import type { Card, Rank, Suit, TrickState } from "../src/index";

const card = (suit: Suit, rank: Rank): Card => ({ suit, rank });

describe("trick winner logic", () => {
  it("ignores trump suit before reveal", () => {
    const trick: TrickState = {
      plays: [
        { player: 0, card: card("hearts", "10") },
        { player: 1, card: card("spades", "J") },
        { player: 2, card: card("hearts", "Q") },
        { player: 3, card: card("hearts", "K") },
      ],
    };

    const winner = winningPlay(trick, "spades", false);
    expect(winner.player).toBe(0);
  });

  it("uses highest trump after reveal", () => {
    const trick: TrickState = {
      plays: [
        { player: 0, card: card("hearts", "10") },
        { player: 1, card: card("spades", "9") },
        { player: 2, card: card("hearts", "A") },
        { player: 3, card: card("spades", "J") },
      ],
    };

    const winner = winningPlay(trick, "spades", true);
    expect(winner.player).toBe(3);
  });

  it("treats Joker trump as no-trump (lead suit wins)", () => {
    const trick: TrickState = {
      plays: [
        { player: 0, card: card("hearts", "10") },
        { player: 1, card: card("spades", "J") },
        { player: 2, card: card("hearts", "A") },
        { player: 3, card: card("clubs", "A") },
      ],
    };

    const winner = winningPlay(trick, null, true);
    expect(winner.player).toBe(2);
  });
});

describe("follow suit rule", () => {
  it("forces a player to follow suit when possible", () => {
    const hand = [card("hearts", "7"), card("spades", "A")];

    const trickWithLead: TrickState = {
      plays: [{ player: 0, card: card("hearts", "10") }],
    };

    const legal = getLegalPlays(hand, trickWithLead);
    expect(legal).toEqual([card("hearts", "7")]);
  });

  it("allows any card when void in the lead suit", () => {
    const hand = [card("spades", "A"), card("clubs", "7")];
    const trickWithLead: TrickState = {
      plays: [{ player: 0, card: card("hearts", "10") }],
    };

    const legal = getLegalPlays(hand, trickWithLead);
    expect(legal).toEqual(hand);
    expect(isLegalPlay(hand, trickWithLead, card("spades", "A"))).toBe(true);
  });
});

describe("seventh card trump rules", () => {
  it("prevents leading trump while hidden when non-trump is available", () => {
    const hand = [card("spades", "J"), card("hearts", "7")];
    const trick: TrickState = { plays: [] };

    const legal = getLegalPlays(hand, trick, {
      trumpSuit: "spades",
      trumpRevealed: false,
      trumpFromSeventh: true,
    });

    expect(legal).toEqual([card("hearts", "7")]);
  });

  it("reveals trump only when a trump card is played", () => {
    const hand = [card("spades", "J"), card("clubs", "7")];
    const trick: TrickState = { plays: [{ player: 0, card: card("hearts", "A") }] };

    const offSuit = playCard({
      trick,
      hand,
      player: 1,
      card: card("clubs", "7"),
      trumpRevealed: false,
      trumpSuit: "spades",
      trumpFromSeventh: true,
    });

    expect(offSuit.trumpRevealed).toBe(false);

    const trumpPlay = playCard({
      trick,
      hand,
      player: 1,
      card: card("spades", "J"),
      trumpRevealed: false,
      trumpSuit: "spades",
      trumpFromSeventh: true,
    });

    expect(trumpPlay.trumpRevealed).toBe(true);
  });

  it("allows leading trump when no non-trumps are available", () => {
    const hand = [card("spades", "J"), card("spades", "7")];
    const trick: TrickState = { plays: [] };

    const legal = getLegalPlays(hand, trick, {
      trumpSuit: "spades",
      trumpRevealed: false,
      trumpFromSeventh: true,
    });

    expect(legal).toEqual(hand);
  });
});

describe("scoring totals", () => {
  it("adds last trick bonus so total hand points equal 29", () => {
    const deck = createDeck();
    const tricks: TrickState[] = [];

    for (let i = 0; i < deck.length; i += 4) {
      const plays = deck.slice(i, i + 4).map((cardItem, index) => ({
        player: index,
        card: cardItem,
      }));
      tricks.push({ plays });
    }

    const total = tricks.reduce((sum, trick, index) => {
      return sum + scoreTrick(trick, index === 7);
    }, 0);

    expect(total).toBe(29);
  });
});

describe("trick utilities", () => {
  it("returns null lead suit for an empty trick", () => {
    expect(leadSuit({ plays: [] })).toBeNull();
  });

  it("does not reveal trump when there is no lead suit", () => {
    const hand = [card("hearts", "7")];
    expect(shouldRevealTrump(hand, { plays: [] })).toBe(false);
  });

  it("throws when a trick has an invalid lead suit", () => {
    const invalidCard = { suit: undefined, rank: "7" } as unknown as Card;
    const trick: TrickState = { plays: [{ player: 0, card: invalidCard }] };
    expect(() => winningPlay(trick, "spades", true)).toThrow("lead suit");
  });

  it("throws when playing an illegal card", () => {
    const hand = [card("hearts", "7"), card("spades", "A")];
    const trick: TrickState = {
      plays: [{ player: 0, card: card("hearts", "10") }],
    };

    expect(() =>
      playCard({
        trick,
        hand,
        player: 1,
        card: card("spades", "A"),
        trumpRevealed: false,
      })
    ).toThrow("Illegal play");
  });

  it("reveals trump when a player is void and trump is not from the seventh", () => {
    const hand = [card("spades", "A")];
    const trick: TrickState = {
      plays: [{ player: 0, card: card("hearts", "10") }],
    };

    const result = playCard({
      trick,
      hand,
      player: 1,
      card: card("spades", "A"),
      trumpRevealed: false,
    });

    expect(result.trumpRevealed).toBe(true);
  });

  it("throws when evaluating an empty trick winner", () => {
    expect(() => winningPlay({ plays: [] }, "spades", true)).toThrow("empty trick");
  });

  it("sums trick points without the last trick bonus", () => {
    const trick: TrickState = {
      plays: [
        { player: 0, card: card("hearts", "J") },
        { player: 1, card: card("hearts", "9") },
        { player: 2, card: card("hearts", "A") },
        { player: 3, card: card("hearts", "10") },
      ],
    };

    expect(trickPoints(trick)).toBe(7);
    expect(scoreTrick(trick, false)).toBe(7);
  });
});

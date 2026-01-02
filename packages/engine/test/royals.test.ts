import { describe, expect, it } from "vitest";
import { adjustBidTargetForRoyals, canDeclareRoyals, hasRoyals } from "../src/index";
import type { Card, EngineConfig, Rank, Suit } from "../src/index";

const card = (suit: Suit, rank: Rank): Card => ({ suit, rank });

const config: EngineConfig = {
  minBid: 16,
  maxBidTarget: 29,
  royalsAdjustment: 4,
  openingLead: "left-of-dealer",
};

describe("royals declaration rules", () => {
  it("requires K+Q of trump in a single hand", () => {
    const hand = [card("spades", "K"), card("spades", "Q")];
    expect(hasRoyals(hand, "spades")).toBe(true);
    expect(hasRoyals([card("spades", "K")], "spades")).toBe(false);
    expect(hasRoyals([card("spades", "Q")], "spades")).toBe(false);
  });

  it("cannot declare before trump reveal", () => {
    const hand = [card("spades", "K"), card("spades", "Q")];
    const allowed = canDeclareRoyals({
      hand,
      trumpSuit: "spades",
      trumpRevealed: false,
      lastTrickWinnerTeam: 0,
      declarerTeam: 0,
    });
    expect(allowed).toBe(false);
  });

  it("can only declare after the declaring team wins a trick", () => {
    const hand = [card("spades", "K"), card("spades", "Q")];
    const allowed = canDeclareRoyals({
      hand,
      trumpSuit: "spades",
      trumpRevealed: true,
      lastTrickWinnerTeam: 1,
      declarerTeam: 0,
    });
    expect(allowed).toBe(false);
  });

  it("allows declaration when all conditions are met", () => {
    const hand = [card("spades", "K"), card("spades", "Q")];
    const allowed = canDeclareRoyals({
      hand,
      trumpSuit: "spades",
      trumpRevealed: true,
      lastTrickWinnerTeam: 0,
      declarerTeam: 0,
    });
    expect(allowed).toBe(true);
  });
});

describe("royals bid target adjustments", () => {
  it("reduces bidder target by 4 with a minBid floor", () => {
    expect(
      adjustBidTargetForRoyals({
        currentTarget: 20,
        declarerTeam: 0,
        bidderTeam: 0,
        config,
      })
    ).toBe(16);

    expect(
      adjustBidTargetForRoyals({
        currentTarget: 18,
        declarerTeam: 0,
        bidderTeam: 0,
        config,
      })
    ).toBe(16);
  });

  it("increases bidder target by 4 with a 29 cap", () => {
    expect(
      adjustBidTargetForRoyals({
        currentTarget: 20,
        declarerTeam: 1,
        bidderTeam: 0,
        config,
      })
    ).toBe(24);

    expect(
      adjustBidTargetForRoyals({
        currentTarget: 27,
        declarerTeam: 1,
        bidderTeam: 0,
        config,
      })
    ).toBe(29);
  });
});

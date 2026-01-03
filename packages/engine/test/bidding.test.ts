import { describe, expect, it } from "vitest";
import { createGameState, reduceGame } from "../src/index";
import type { EngineConfig } from "../src/index";

const baseConfig: EngineConfig = {
  minBid: 16,
  maxBidTarget: 29,
  royalsAdjustment: 4,
  openingLead: "left-of-dealer",
};

describe("bidding flow", () => {
  it("deals four cards per player for the bidding round", () => {
    const state = createGameState({ seed: 1, dealer: 0, config: baseConfig });

    expect(state.hands.every((hand) => hand.length === 4)).toBe(true);
    expect(state.undealt.length).toBe(16);
  });

  it("deals the remaining cards after trump is chosen", () => {
    let state = createGameState({ seed: 2, dealer: 0, config: baseConfig });
    state = reduceGame(state, { type: "placeBid", player: 1, amount: 16 });
    state = reduceGame(state, { type: "passBid", player: 2 });
    state = reduceGame(state, { type: "passBid", player: 3 });
    state = reduceGame(state, { type: "passBid", player: 0 });

    expect(state.phase).toBe("choose-trump");
    expect(state.hands.every((hand) => hand.length === 4)).toBe(true);

    state = reduceGame(state, { type: "chooseTrump", player: 1, suit: "hearts" });

    expect(state.phase).toBe("playing");
    expect(state.hands.every((hand) => hand.length === 8)).toBe(true);
    expect(state.undealt.length).toBe(0);
  });

  it("ends bidding after three passes following a bid", () => {
    let state = createGameState({ seed: 1, dealer: 0, config: baseConfig });
    state = reduceGame(state, { type: "placeBid", player: 1, amount: 16 });
    state = reduceGame(state, { type: "passBid", player: 2 });
    state = reduceGame(state, { type: "passBid", player: 3 });
    state = reduceGame(state, { type: "passBid", player: 0 });

    expect(state.phase).toBe("choose-trump");
    expect(state.currentPlayer).toBe(1);
    expect(state.bidTarget).toBe(16);
    expect(state.bidderPlayer).toBe(1);
  });

  it("redeals when all players pass", () => {
    let state = createGameState({ seed: 4, dealer: 0, config: baseConfig });
    state = reduceGame(state, { type: "passBid", player: 1 });
    state = reduceGame(state, { type: "passBid", player: 2 });
    state = reduceGame(state, { type: "passBid", player: 3 });
    state = reduceGame(state, { type: "passBid", player: 0 });

    expect(state.phase).toBe("bidding");
    expect(state.dealer).toBe(1);
    expect(state.currentPlayer).toBe(2);
    expect(state.bidTarget).toBe(null);
  });

  it("starts play with left-of-dealer leading by default", () => {
    let state = createGameState({ seed: 8, dealer: 0, config: baseConfig });
    state = reduceGame(state, { type: "passBid", player: 1 });
    state = reduceGame(state, { type: "placeBid", player: 2, amount: 16 });
    state = reduceGame(state, { type: "passBid", player: 3 });
    state = reduceGame(state, { type: "passBid", player: 0 });
    state = reduceGame(state, { type: "passBid", player: 1 });
    state = reduceGame(state, { type: "chooseTrump", player: 2, suit: "hearts" });

    expect(state.phase).toBe("playing");
    expect(state.leader).toBe(1);
    expect(state.currentPlayer).toBe(1);
  });

  it("can start play with bidder leading when configured", () => {
    const config: EngineConfig = { ...baseConfig, openingLead: "bidder" };
    let state = createGameState({ seed: 12, dealer: 0, config });
    state = reduceGame(state, { type: "passBid", player: 1 });
    state = reduceGame(state, { type: "placeBid", player: 2, amount: 16 });
    state = reduceGame(state, { type: "passBid", player: 3 });
    state = reduceGame(state, { type: "passBid", player: 0 });
    state = reduceGame(state, { type: "passBid", player: 1 });
    state = reduceGame(state, { type: "chooseTrump", player: 2, suit: "spades" });

    expect(state.phase).toBe("playing");
    expect(state.leader).toBe(2);
    expect(state.currentPlayer).toBe(2);
  });
});

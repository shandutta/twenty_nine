import { describe, expect, it } from "vitest";
import { createDeck, createGameState, shuffleDeck } from "../src/index";

describe("game setup", () => {
  it("uses the seventh card as the trump suit", () => {
    const seed = 12345;
    const deck = shuffleDeck(createDeck(), seed);

    const state = createGameState({ seed });

    expect(state.trumpSuit).toBe(deck[6].suit);
  });
});

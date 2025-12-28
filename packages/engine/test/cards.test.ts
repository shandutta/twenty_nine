import { describe, expect, it } from "vitest";
import { cardPoints, compareRanks, createDeck, RANK_ORDER } from "../src/index";

describe("rank comparisons", () => {
  it("orders ranks according to 29 rules", () => {
    for (let i = 0; i < RANK_ORDER.length; i += 1) {
      for (let j = i + 1; j < RANK_ORDER.length; j += 1) {
        const higher = RANK_ORDER[i];
        const lower = RANK_ORDER[j];
        expect(compareRanks(higher, lower)).toBeGreaterThan(0);
        expect(compareRanks(lower, higher)).toBeLessThan(0);
      }
    }
  });

  it("treats identical ranks as equal", () => {
    for (const rank of RANK_ORDER) {
      expect(compareRanks(rank, rank)).toBe(0);
    }
  });
});

describe("deck points", () => {
  it("sums to 28 points for a full deck", () => {
    const total = createDeck().reduce((sum, card) => sum + cardPoints(card), 0);
    expect(total).toBe(28);
  });
});

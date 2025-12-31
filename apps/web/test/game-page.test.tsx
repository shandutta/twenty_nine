import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Card, GameState } from "@twentynine/engine";
import { createGame } from "@twentynine/engine";
import GamePage from "@/app/game/page";
import { useGameController } from "@/hooks/useGameController";

vi.mock("@/hooks/useGameController");

const mockedUseGameController = vi.mocked(useGameController);

const card = (suit: Card["suit"], rank: Card["rank"]): Card => ({
  suit,
  rank,
});

const makeState = (hand: Card[]): GameState => {
  const base = createGame(1, { trumpSuit: "spades" });
  return {
    ...base,
    currentPlayer: 0,
    players: [{ hand }, { hand: [] }, { hand: [] }, { hand: [] }],
    trick: { plays: [], leadSuit: null },
    completedTricks: [],
  };
};

beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    json: async () => ({ configured: true }),
  })) as unknown as typeof fetch);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("/game UI", () => {
  let playCardMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const legal = card("hearts", "7");
    const illegal = card("spades", "A");
    playCardMock = vi.fn();
    mockedUseGameController.mockReturnValue({
      state: makeState([legal, illegal]),
      legalMoves: [legal],
      isGameOver: false,
      score: {
        team0: 0,
        team1: 0,
        cardPoints: { team0: 0, team1: 0 },
        lastTrickBonusWinner: null,
      },
      humanPlayer: 0,
      playCard: playCardMock,
      canShowPair: false,
      showPair: vi.fn(),
      resetGame: vi.fn(),
      lastMove: null,
      botSettings: {
        enabled: false,
        difficulty: "easy",
        model: "openai/gpt-4o-mini",
        temperature: 0.2,
        usageHint: "Uses LLM only when 2 or fewer legal moves.",
      },
      setBotEnabled: vi.fn(),
      setBotDifficulty: vi.fn(),
    });
  });

  it("disables illegal moves", () => {
    render(<GamePage />);
    const legalButtons = screen.getAllByRole("button", { name: "7H" });
    expect(legalButtons[0]).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "AS" })).toBeDisabled();
  });

  it("clicking a legal card dispatches play", () => {
    render(<GamePage />);
    const button = screen.getAllByRole("button", { name: "7H" })[0];
    fireEvent.click(button);
    expect(playCardMock).toHaveBeenCalledWith(card("hearts", "7"));
  });
});

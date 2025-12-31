import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Card, GameState, CompletedTrick } from "@twentynine/engine";
import { createGame } from "@twentynine/engine";
import GamePage from "@/app/game/page";
import { useGameController } from "@/hooks/useGameController";

vi.mock("@/hooks/useGameController");

const mockedUseGameController = vi.mocked(useGameController);

const card = (suit: Card["suit"], rank: Card["rank"]): Card => ({
  suit,
  rank,
});

const makeState = (hand: Card[], overrides?: Partial<GameState>): GameState => {
  const base = createGame(1, { trumpSuit: "spades" });
  return {
    ...base,
    currentPlayer: 0,
    players: [{ hand }, { hand: [] }, { hand: [] }, { hand: [] }],
    trick: { plays: [], leadSuit: null },
    completedTricks: [],
    ...overrides,
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/game UI", () => {
  let playCardMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      json: async () => ({ configured: true }),
    })) as unknown as typeof fetch);

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
    const legalButtons = screen.getAllByRole("button", { name: "7 of Hearts" });
    expect(legalButtons[0]).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: "A of Spades" })
    ).toBeDisabled();
  });

  it("clicking a legal card dispatches play", () => {
    render(<GamePage />);
    const button = screen.getAllByRole("button", { name: "7 of Hearts" })[0];
    fireEvent.click(button);
    expect(playCardMock).toHaveBeenCalledWith(card("hearts", "7"));
  });

  it("renders game-over UI and coach warning when OpenRouter missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      json: async () => ({ configured: false }),
    })) as unknown as typeof fetch);

    const legal = card("hearts", "7");
    const completedTricks: CompletedTrick[] = [
      {
        winner: 2,
        plays: [
          { player: 0, card: card("clubs", "J") },
          { player: 1, card: card("clubs", "9") },
          { player: 2, card: card("clubs", "A") },
          { player: 3, card: card("clubs", "7") },
        ],
      },
    ];
    const state = makeState([legal], {
      currentPlayer: 1,
      trumpRevealed: true,
      trick: {
        leadSuit: "clubs",
        plays: [{ player: 1, card: card("clubs", "10") }],
      },
      completedTricks,
    });

    mockedUseGameController.mockReturnValue({
      state,
      legalMoves: [legal],
      isGameOver: true,
      score: {
        team0: 17,
        team1: 12,
        cardPoints: { team0: 16, team1: 12 },
        lastTrickBonusWinner: 0,
      },
      humanPlayer: 0,
      playCard: vi.fn(),
      canShowPair: true,
      showPair: vi.fn(),
      resetGame: vi.fn(),
      lastMove: {
        id: 1,
        action: { type: "play_card", player: 0, card: legal },
        legalMoves: [legal],
      },
      botSettings: {
        enabled: true,
        difficulty: "hard",
        model: "openai/gpt-4o",
        temperature: 0.7,
        usageHint: "Uses LLM on every bot move.",
      },
      setBotEnabled: vi.fn(),
      setBotDifficulty: vi.fn(),
    });

    render(<GamePage />);

    const warnings = await screen.findAllByText(
      /OPENROUTER_API_KEY not configured/i
    );
    expect(warnings).toHaveLength(2);
    const bonus = screen.getAllByText(/Last trick bonus: Team 0/i);
    expect(bonus.length).toBeGreaterThan(0);
    const tricks = screen.getAllByText(/Trick 1/i);
    expect(tricks.length).toBeGreaterThan(0);
    const finals = screen.getAllByText(/Final: Team 0 wins/i);
    expect(finals.length).toBeGreaterThan(0);

    const coachHeader = screen.getAllByText("AI Coach")[0];
    expect(coachHeader).toBeInTheDocument();
  });
});

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createGameState } from "@twentynine/engine";
import type { GameState as EngineState } from "@twentynine/engine";
import GamePage from "@/app/game/page";
import { useGameController } from "@/components/game/use-game-controller";
import type { GameState, PlayingCard } from "@/components/game/types";

vi.mock("@/components/game/use-game-controller");

const mockedUseGameController = vi.mocked(useGameController);

const makeCard = (suit: PlayingCard["suit"], rank: PlayingCard["rank"]): PlayingCard => ({
  suit,
  rank,
  id: `${suit}-${rank}`,
});

const makeGameState = (cards: PlayingCard[]): GameState => ({
  players: [
    { id: "player1", name: "You", position: "bottom", cards, isCurrentPlayer: true, teamId: "teamA" },
    { id: "player2", name: "West", position: "left", cards: [], isCurrentPlayer: false, teamId: "teamB" },
    { id: "player3", name: "North", position: "top", cards: [], isCurrentPlayer: false, teamId: "teamA" },
    { id: "player4", name: "East", position: "right", cards: [], isCurrentPlayer: false, teamId: "teamB" },
  ],
  teams: {
    teamA: {
      id: "teamA",
      name: "You & North",
      players: ["player1", "player3"],
      tricksWon: 0,
      bid: 16,
      bidWinner: "player1",
      gameScore: 0,
      handPoints: 0,
    },
    teamB: {
      id: "teamB",
      name: "West & East",
      players: ["player2", "player4"],
      tricksWon: 0,
      gameScore: 0,
      handPoints: 0,
    },
  },
  trumpSuit: "spades",
  trumpRevealed: false,
  currentTrick: [],
  phase: "playing",
  currentBid: 16,
  bidWinner: "player1",
  royalsDeclaredBy: null,
  royalsAdjustment: 4,
  royalsMinTarget: 16,
  royalsMaxTarget: 29,
  roundNumber: 1,
  trickNumber: 0,
  currentPlayerId: "player1",
  log: [],
  lastTrick: null,
});

const makeEngineState = (): EngineState => createGameState({ seed: 1, trumpSuit: "spades", bidTarget: 16 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/game UI", () => {
  let playCardMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ configured: true }),
      })) as unknown as typeof fetch
    );

    const legal = makeCard("hearts", "7");
    const illegal = makeCard("spades", "A");
    playCardMock = vi.fn();

    mockedUseGameController.mockReturnValue({
      gameState: makeGameState([legal, illegal]),
      engineState: makeEngineState(),
      legalCardIds: [legal.id],
      onPlayCard: playCardMock,
      onNewGame: vi.fn(),
      canRevealTrump: false,
      onRevealTrump: vi.fn(),
      canDeclareRoyals: false,
      onDeclareRoyals: vi.fn(),
      lastMove: null,
      botSettings: {
        enabled: false,
        difficulty: "easy",
        model: "openai/gpt-5.2-pro",
        fallbackModels: ["anthropic/claude-opus-4.5", "google/gemini-3-pro-preview"],
        temperature: 0.2,
        usageHint: "Uses LLM on every bot move (conservative style).",
      },
      llmInUse: false,
      setBotEnabled: vi.fn(),
      setBotDifficulty: vi.fn(),
    });
  });

  it("disables illegal moves", async () => {
    render(<GamePage />);
    const legalButtons = await screen.findAllByRole("button", { name: "7 of Hearts" });
    const illegalButtons = await screen.findAllByRole("button", { name: "A of Spades" });
    const isAriaDisabled = (button: HTMLElement) => button.getAttribute("aria-disabled") === "true";
    const legalButton = legalButtons.find((button) => !isAriaDisabled(button)) ?? legalButtons[0];
    const illegalButton = illegalButtons.find((button) => isAriaDisabled(button)) ?? illegalButtons[0];
    expect(isAriaDisabled(legalButton)).toBe(false);
    expect(isAriaDisabled(illegalButton)).toBe(true);
  });

  it("renders the AI tools tab", async () => {
    render(<GamePage />);
    const [aiTab] = await screen.findAllByRole("tab", { name: /AI/i });
    fireEvent.mouseDown(aiTab, { button: 0 });
    expect(await screen.findByRole("heading", { name: "LLM Bots" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI Coach" })).toBeInTheDocument();
  });
});

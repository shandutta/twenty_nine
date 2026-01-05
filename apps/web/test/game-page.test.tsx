import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
  matchRound: 1,
  matchRedPips: [0, 0],
  matchBlackPips: [0, 0],
  matchWinner: null,
  matchEndReason: null,
  trickNumber: 0,
  currentPlayerId: "player1",
  log: [],
  lastTrick: null,
});

const makeEngineState = (): EngineState =>
  createGameState({ seed: 1, trumpSuit: "spades", bidTarget: 16, phase: "playing" });

type ControllerState = ReturnType<typeof useGameController>;

const baseBotSettings = {
  enabled: false,
  difficulty: "easy",
  model: "openai/gpt-5.2-chat",
  fallbackModels: ["anthropic/claude-opus-4.5", "google/gemini-3-pro-preview"],
  temperature: 0.2,
  usageHint: "Conservative: protects high-value points and plays safely.",
  reasoningEffort: "high",
} as const;

const makeControllerState = (overrides: Partial<ControllerState> = {}): ControllerState =>
  ({
    gameState: makeGameState([makeCard("hearts", "7"), makeCard("spades", "A")]),
    engineState: makeEngineState(),
    legalCardIds: ["hearts-7"],
    onPlayCard: vi.fn(),
    bidOptions: [],
    canBid: false,
    onPlaceBid: vi.fn(),
    onPassBid: vi.fn(),
    canChooseTrump: false,
    onChooseTrump: vi.fn(),
    onChooseTrumpFromSeventh: vi.fn(),
    onNewGame: vi.fn(),
    onNextHand: vi.fn(),
    canStartNextHand: false,
    canRevealTrump: false,
    onRevealTrump: vi.fn(),
    canDeclareRoyals: false,
    onDeclareRoyals: vi.fn(),
    lastMove: null,
    botSettings: baseBotSettings,
    llmInUse: false,
    trickResolution: { pending: false, open: false, summary: null },
    onAcknowledgeTrickResolution: vi.fn(),
    setBotEnabled: vi.fn(),
    setBotDifficulty: vi.fn(),
    setBotModel: vi.fn(),
    setBotTemperature: vi.fn(),
    setReasoningEffort: vi.fn(),
    setShowReasoningTrace: vi.fn(),
    controlMode: "standard",
    controlModeLocked: false,
    onControlModeChange: vi.fn(),
    ...overrides,
  }) satisfies ControllerState;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/game UI", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ configured: true }),
      })) as unknown as typeof fetch
    );

    mockedUseGameController.mockReturnValue(makeControllerState());
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

  it("confirms before starting a new match", async () => {
    const onNewGame = vi.fn();
    mockedUseGameController.mockReturnValue(makeControllerState({ onNewGame }));

    render(<GamePage />);
    const [newMatchButton] = await screen.findAllByRole("button", { name: /New Match/i });
    fireEvent.click(newMatchButton);

    expect(await screen.findByText(/Start a new match\?/i)).toBeInTheDocument();
    const confirmButton = await screen.findByRole("button", { name: /Start New Match/i });
    fireEvent.click(confirmButton);

    expect(onNewGame).toHaveBeenCalled();
  });

  it("shows trick resolution details and acknowledges the dialog", async () => {
    const onAcknowledgeTrickResolution = vi.fn();
    const lastTrick = {
      trickNumber: 3,
      winnerPlayerId: "player2",
      winnerTeamId: "teamB" as const,
      winningCard: makeCard("hearts", "A"),
      points: 5,
      plays: [
        { playerId: "player1", card: makeCard("hearts", "7") },
        { playerId: "player2", card: makeCard("hearts", "A") },
        { playerId: "player3", card: makeCard("hearts", "9") },
        { playerId: "player4", card: makeCard("hearts", "10") },
      ],
    };
    const gameState = {
      ...makeGameState([makeCard("clubs", "7")]),
      currentPlayerId: "player2",
      lastTrick,
    };

    mockedUseGameController.mockReturnValue(
      makeControllerState({
        gameState,
        trickResolution: { pending: true, open: true, summary: lastTrick },
        onAcknowledgeTrickResolution,
      })
    );

    render(<GamePage />);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Trick 3 resolved/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Winning card/i)).toBeInTheDocument();

    const okButton = within(dialog).getByRole("button", { name: /OK - Next trick/i });
    fireEvent.click(okButton);
    expect(onAcknowledgeTrickResolution).toHaveBeenCalled();
  });

  it("requests a coach response when enabled", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/openrouter/models")) {
        return {
          ok: true,
          json: async () => ({ models: [{ id: "openai/gpt-5.2-chat", supportsReasoning: true }] }),
        };
      }
      if (url.includes("/api/openrouter") && (!init || init.method === "GET")) {
        return { ok: true, json: async () => ({ configured: true }) };
      }
      if (url.includes("/api/openrouter") && init?.method === "POST") {
        return { ok: true, json: async () => ({ message: { content: "Play the 7 of Hearts." } }) };
      }
      return { ok: false, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<GamePage />);
    const [aiTab] = await screen.findAllByRole("tab", { name: /AI/i });
    fireEvent.mouseDown(aiTab, { button: 0 });

    const coachHeading = await screen.findByRole("heading", { name: "AI Coach" });
    const coachCard = coachHeading.closest('[data-slot="card"]');
    expect(coachCard).toBeTruthy();
    const coachSwitch = within(coachCard as HTMLElement).getByRole("switch");
    fireEvent.click(coachSwitch);

    const coachButton = within(coachCard as HTMLElement).getByRole("button", { name: /Coach my turn/i });
    fireEvent.click(coachButton);

    expect(await screen.findByText(/Play the 7 of Hearts\./i)).toBeInTheDocument();
  });
});

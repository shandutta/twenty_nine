import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { Card } from "@twentynine/engine";
import type { GameState, PlayingCard } from "@/components/game/types";
import { useGameController, type LastMoveInfo } from "@/components/game/use-game-controller";

vi.mock("@/components/game/use-game-controller");
vi.mock("@/components/game/use-sound-effects", () => ({ useSoundEffects: vi.fn() }));

type SidebarProps = {
  gameState: GameState;
  legalMovesSummary: string;
  lastMoveSummary: string;
  easyMode: boolean;
  onOpenSettings: () => void;
  onCoachEnabledChange: (enabled: boolean) => void;
  onRequestCoach: () => void | Promise<void>;
  canRequestCoach: boolean;
  coachError: string | null;
  coachResponse: string | null;
} & Record<string, unknown>;

type SettingsProps = {
  open: boolean;
  onEasyModeChange: (enabled: boolean) => void;
} & Record<string, unknown>;

type AlertDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
};

type AlertDialogButtonProps = React.ComponentProps<"button">;
type AlertDialogContentProps = React.ComponentProps<"div">;

let latestSidebarProps: SidebarProps | null = null;
let latestSettingsProps: SettingsProps | null = null;

const getSidebarProps = (): SidebarProps => {
  if (!latestSidebarProps) {
    throw new Error("Sidebar props not set");
  }
  return latestSidebarProps;
};

const getSettingsProps = (): SettingsProps => {
  if (!latestSettingsProps) {
    throw new Error("Settings props not set");
  }
  return latestSettingsProps;
};

vi.mock("@/components/game/sidebar", () => ({
  GameSidebar: (props: SidebarProps) => {
    latestSidebarProps = props;
    return <div data-testid="sidebar" />;
  },
}));

vi.mock("@/components/game/table", () => ({
  GameTable: () => <div data-testid="table" />,
}));

vi.mock("@/components/game/settings-sheet", () => ({
  SettingsSheet: (props: SettingsProps) => {
    latestSettingsProps = props;
    return <div data-testid="settings" />;
  },
}));

vi.mock("@/components/ui/alert-dialog", () => {
  return {
    AlertDialog: ({ open, onOpenChange, children }: AlertDialogProps) => {
      React.useEffect(() => {
        if (open && onOpenChange) {
          onOpenChange(false);
        }
      }, [open, onOpenChange]);
      return <div data-testid="alert-dialog">{children}</div>;
    },
    AlertDialogAction: ({ onClick, children }: AlertDialogButtonProps) => <button onClick={onClick}>{children}</button>,
    AlertDialogCancel: ({ onClick, children }: AlertDialogButtonProps) => <button onClick={onClick}>{children}</button>,
    AlertDialogContent: ({ children }: AlertDialogContentProps) => <div>{children}</div>,
    AlertDialogDescription: ({ children }: AlertDialogContentProps) => <div>{children}</div>,
    AlertDialogFooter: ({ children }: AlertDialogContentProps) => <div>{children}</div>,
    AlertDialogHeader: ({ children }: AlertDialogContentProps) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: AlertDialogContentProps) => <div>{children}</div>,
  };
});

const mockedUseGameController = vi.mocked(useGameController);

const makeCard = (suit: PlayingCard["suit"], rank: PlayingCard["rank"]): PlayingCard => ({
  suit,
  rank,
  id: `${suit}-${rank}`,
});

const makeLastMove = (player: number, card: Card): LastMoveInfo => ({
  action: { type: "playCard", player, card },
  legalMoves: [],
});

const makeGameState = (overrides: Partial<GameState> = {}): GameState => {
  const base: GameState = {
    players: [
      {
        id: "player1",
        name: "You",
        position: "bottom",
        cards: [makeCard("hearts", "7")],
        isCurrentPlayer: true,
        teamId: "teamA",
      },
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
  };

  return {
    ...base,
    ...overrides,
    players: overrides.players ?? base.players,
    teams: overrides.teams ?? base.teams,
    lastTrick: overrides.lastTrick ?? base.lastTrick,
  };
};

const baseControllerState = (overrides: Partial<ReturnType<typeof useGameController>> = {}) => ({
  gameState: makeGameState(),
  engineState: {
    seed: 1,
    phase: "playing",
    bidTarget: 16,
    bidderPlayer: 0,
    bidderTeam: 0,
    trumpSuit: "spades",
    trumpRevealed: false,
    trumpFromSeventh: false,
    hands: [],
    undealt: [],
    trick: { plays: [] },
    trickNumber: 0,
    leader: 0,
    currentPlayer: 0,
    dealer: 0,
    points: [0, 0],
    tricksWon: [0, 0],
    bidPasses: 0,
    bidHistory: [],
    lastTrickWinnerTeam: null,
    lastTrick: null,
    royalsDeclaredBy: null,
    log: [],
    config: { minBid: 16, maxBidTarget: 29, royalsAdjustment: 4, openingLead: "left-of-dealer" },
    matchRound: 1,
    matchRedPips: [0, 0],
    matchBlackPips: [0, 0],
    matchWinner: null,
    matchEndReason: null,
  },
  legalCardIds: [],
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
  botSettings: {
    enabled: false,
    difficulty: "easy",
    model: "openai/gpt-5.2-chat",
    fallbackModels: ["anthropic/claude-opus-4.5"],
    temperature: 0.2,
    usageHint: "Conservative: protects high-value points and plays safely.",
    reasoningEffort: "high",
  },
  llmInUse: false,
  trickResolution: { pending: false, open: false, summary: null },
  onAcknowledgeTrickResolution: vi.fn(),
  setBotEnabled: vi.fn(),
  setBotDifficulty: vi.fn(),
  setBotModel: vi.fn(),
  setBotTemperature: vi.fn(),
  setReasoningEffort: vi.fn(),
  controlMode: "standard",
  controlModeLocked: false,
  onControlModeChange: vi.fn(),
  ...overrides,
});

describe("GamePage logic branches", () => {
  beforeEach(() => {
    latestSidebarProps = null;
    latestSettingsProps = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/api/openrouter/models")) {
          return { ok: true, json: async () => ({ models: [] }) } as Response;
        }
        if (url.includes("/api/openrouter") && (!init || init.method === "GET")) {
          return { ok: true, json: async () => ({ configured: true }) } as Response;
        }
        return { ok: true, json: async () => ({ message: { content: "OK" } }) } as Response;
      }) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("handles empty players and pending trump state", async () => {
    mockedUseGameController.mockReturnValue(
      baseControllerState({
        gameState: makeGameState({ players: [], trumpSuit: null, phase: "bidding", currentPlayerId: "" }),
        legalCardIds: [],
      })
    );

    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    const sidebarProps = getSidebarProps();
    expect(sidebarProps.legalMovesSummary).toBe("--");
    expect(sidebarProps.lastMoveSummary).toBe("No moves yet.");
  });

  it("falls back to P# labels for unknown players", async () => {
    mockedUseGameController.mockReturnValue(
      baseControllerState({
        gameState: makeGameState({
          players: [
            {
              id: "player1",
              name: "You",
              position: "bottom",
              cards: [makeCard("hearts", "7")],
              isCurrentPlayer: true,
              teamId: "teamA",
            },
            { id: "player2", name: "West", position: "left", cards: [], isCurrentPlayer: false, teamId: "teamB" },
          ],
          lastTrick: null,
          currentPlayerId: "player1",
        }),
        lastMove: makeLastMove(3, { suit: "hearts", rank: "7" }),
        legalCardIds: ["hearts-7"],
      })
    );

    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    const sidebarProps = getSidebarProps();
    expect(sidebarProps.lastMoveSummary).toContain("P4 played");
    expect(sidebarProps.legalMovesSummary).not.toBe("--");
  });

  it("uses known player names for last move summaries", async () => {
    mockedUseGameController.mockReturnValue(
      baseControllerState({
        lastMove: makeLastMove(1, { suit: "spades", rank: "J" }),
      })
    );

    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    expect(getSidebarProps().lastMoveSummary).toContain("West played");
  });

  it("computes the revealed trump label when trump is shown", async () => {
    mockedUseGameController.mockReturnValue(
      baseControllerState({
        gameState: makeGameState({ trumpSuit: "spades", trumpRevealed: true }),
      })
    );

    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    expect(getSidebarProps().gameState.trumpRevealed).toBe(true);
  });

  it("opens the settings sheet from the sidebar action", async () => {
    mockedUseGameController.mockReturnValue(baseControllerState());

    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    expect(getSettingsProps().open).toBe(false);

    act(() => {
      getSidebarProps().onOpenSettings();
    });

    await waitFor(() => {
      expect(getSettingsProps().open).toBe(true);
    });
  });

  it("reads and persists easy mode from localStorage", async () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem").mockReturnValue("true");
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});

    mockedUseGameController.mockReturnValue(baseControllerState());
    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    await waitFor(() => {
      expect(getSidebarProps().easyMode).toBe(true);
    });

    act(() => {
      getSettingsProps().onEasyModeChange(false);
    });

    await waitFor(() => {
      expect(setSpy).toHaveBeenCalledWith("twentynine.easyMode", "false");
    });

    getSpy.mockRestore();
    setSpy.mockRestore();
  });

  it("ignores localStorage access failures", async () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    mockedUseGameController.mockReturnValue(baseControllerState());
    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    act(() => {
      getSettingsProps().onEasyModeChange(true);
    });

    getSpy.mockRestore();
    setSpy.mockRestore();
  });

  it("returns early when coach is disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    mockedUseGameController.mockReturnValue(baseControllerState());
    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    await act(async () => {
      await getSidebarProps().onRequestCoach();
    });

    expect(fetchMock).not.toHaveBeenCalledWith("/api/openrouter", expect.anything());
  });

  it("sets coach errors for invalid turn or phase", async () => {
    mockedUseGameController.mockReturnValue(
      baseControllerState({
        gameState: makeGameState({ currentPlayerId: "player2", phase: "playing" }),
      })
    );

    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    act(() => {
      getSidebarProps().onCoachEnabledChange(true);
    });

    await act(async () => {
      await getSidebarProps().onRequestCoach();
    });

    await waitFor(() => {
      expect(getSidebarProps().coachError).toContain("only available on your turn");
    });
  });

  it("blocks coach requests outside the playing phase", async () => {
    mockedUseGameController.mockReturnValue(
      baseControllerState({
        gameState: makeGameState({ currentPlayerId: "player1", phase: "bidding" }),
      })
    );

    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    act(() => {
      getSidebarProps().onCoachEnabledChange(true);
    });

    await act(async () => {
      await getSidebarProps().onRequestCoach();
    });

    await waitFor(() => {
      expect(getSidebarProps().coachError).toContain("only available on your turn");
    });
  });

  it("blocks coach requests when OpenRouter is not configured", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/openrouter/models")) {
        return { ok: true, json: async () => ({ models: [] }) } as Response;
      }
      if (!init || init.method === "GET") {
        return { ok: true, json: async () => ({ configured: false }) } as Response;
      }
      return { ok: true, json: async () => ({ message: { content: "OK" } }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    mockedUseGameController.mockReturnValue(baseControllerState());
    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    act(() => {
      getSidebarProps().onCoachEnabledChange(true);
    });

    await waitFor(() => {
      expect(getSidebarProps().canRequestCoach).toBe(false);
    });

    await act(async () => {
      await getSidebarProps().onRequestCoach();
    });

    await waitFor(() => {
      expect(getSidebarProps().coachError).toContain("OPENROUTER_API_KEY");
    });
  });

  it("marks OpenRouter as unavailable when config fetch fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/openrouter/models")) {
        return { ok: true, json: async () => ({ models: [] }) } as Response;
      }
      if (!init || init.method === "GET") {
        throw new Error("network");
      }
      return { ok: true, json: async () => ({ message: { content: "OK" } }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    mockedUseGameController.mockReturnValue(baseControllerState());
    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    await waitFor(() => {
      expect(getSidebarProps().canRequestCoach).toBe(false);
    });
  });

  it("skips state updates after unmounting", async () => {
    let resolveConfig: ((value: unknown) => void) | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (!init || init.method === "GET") {
        return {
          ok: true,
          json: async () =>
            new Promise((resolve) => {
              resolveConfig = resolve;
            }),
        } as Response;
      }
      return { ok: true, json: async () => ({ message: { content: "OK" } }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    mockedUseGameController.mockReturnValue(baseControllerState());
    const { default: GamePage } = await import("@/app/game/page");
    const { unmount } = render(<GamePage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    unmount();

    resolveConfig?.({ configured: true });
    await act(async () => {});
  });

  it("handles coach response errors and success", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/openrouter/models")) {
        return { ok: true, json: async () => ({ models: [] }) } as Response;
      }
      if (!init || init.method === "GET") {
        return { ok: true, json: async () => ({ configured: true }) } as Response;
      }
      return { ok: false, json: async () => ({ error: "Bad request" }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    mockedUseGameController.mockReturnValue(baseControllerState());
    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    act(() => {
      getSidebarProps().onCoachEnabledChange(true);
    });

    await act(async () => {
      await getSidebarProps().onRequestCoach();
    });

    await waitFor(() => {
      expect(getSidebarProps().coachError).toContain("Bad request");
    });
  });

  it("falls back to a generic error when OpenRouter returns no message", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/openrouter/models")) {
        return { ok: true, json: async () => ({ models: [] }) } as Response;
      }
      if (!init || init.method === "GET") {
        return { ok: true, json: async () => ({ configured: true }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    mockedUseGameController.mockReturnValue(baseControllerState());
    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    act(() => {
      getSidebarProps().onCoachEnabledChange(true);
    });

    await act(async () => {
      await getSidebarProps().onRequestCoach();
    });

    await waitFor(() => {
      expect(getSidebarProps().coachError).toContain("OpenRouter request failed");
    });
  });

  it("handles missing coach content and fetch failures", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/openrouter/models")) {
        return { ok: true, json: async () => ({ models: [] }) } as Response;
      }
      if (!init || init.method === "GET") {
        return { ok: true, json: async () => ({ configured: true }) } as Response;
      }
      return { ok: true, json: async () => ({ message: {} }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    mockedUseGameController.mockReturnValue(baseControllerState());
    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    act(() => {
      getSidebarProps().onCoachEnabledChange(true);
    });

    await act(async () => {
      await getSidebarProps().onRequestCoach();
    });

    await waitFor(() => {
      expect(getSidebarProps().coachError).toContain("No response from coach");
    });

    const throwFetch = vi.fn(async () => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", throwFetch as unknown as typeof fetch);

    await act(async () => {
      await getSidebarProps().onRequestCoach();
    });

    await waitFor(() => {
      expect(getSidebarProps().coachError).toContain("Unable to reach OpenRouter");
    });
  });

  it("records a coach response on success and includes partner hand in single-hand mode", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/openrouter/models")) {
        return { ok: true, json: async () => ({ models: [] }) } as Response;
      }
      if (!init || init.method === "GET") {
        return { ok: true, json: async () => ({ configured: true }) } as Response;
      }
      return { ok: true, json: async () => ({ message: { content: "Play safely." } }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    mockedUseGameController.mockReturnValue(
      baseControllerState({
        controlMode: "single-hand",
        gameState: makeGameState({
          trumpSuit: null,
          trumpRevealed: false,
          phase: "playing",
          currentPlayerId: "player1",
        }),
      })
    );

    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    act(() => {
      getSidebarProps().onCoachEnabledChange(true);
    });

    await act(async () => {
      await getSidebarProps().onRequestCoach();
    });

    await waitFor(() => {
      expect(getSidebarProps().coachResponse).toContain("Play safely");
    });
  });

  it("shows a coach error when the current player is missing", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/openrouter/models")) {
        return { ok: true, json: async () => ({ models: [] }) } as Response;
      }
      if (!init || init.method === "GET") {
        return { ok: true, json: async () => ({ configured: true }) } as Response;
      }
      return { ok: true, json: async () => ({ message: { content: "OK" } }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    mockedUseGameController.mockReturnValue(
      baseControllerState({
        gameState: makeGameState({ players: [], currentPlayerId: "missing" }),
      })
    );

    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    act(() => {
      getSidebarProps().onCoachEnabledChange(true);
    });

    await act(async () => {
      await getSidebarProps().onRequestCoach();
    });

    await waitFor(() => {
      expect(getSidebarProps().coachError).toContain("only available on your turn");
    });
  });

  it("includes last trick details in the coach request payload", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/openrouter/models")) {
        return { ok: true, json: async () => ({ models: [] }) } as Response;
      }
      if (!init || init.method === "GET") {
        return { ok: true, json: async () => ({ configured: true }) } as Response;
      }
      return { ok: true, json: async () => ({ message: { content: "OK" } }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const lastTrick = {
      trickNumber: 2,
      winnerPlayerId: "player2",
      winnerTeamId: "teamB",
      winningCard: makeCard("hearts", "A"),
      points: 4,
      plays: [
        { playerId: "player1", card: makeCard("hearts", "7") },
        { playerId: "player2", card: makeCard("hearts", "A") },
      ],
    };

    mockedUseGameController.mockReturnValue(
      baseControllerState({
        gameState: makeGameState({
          currentTrick: [{ playerId: "player3", card: makeCard("clubs", "7") }],
          lastTrick,
        }),
      })
    );

    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    act(() => {
      getSidebarProps().onCoachEnabledChange(true);
    });

    await act(async () => {
      await getSidebarProps().onRequestCoach();
    });

    const call = fetchMock.mock.calls.find(
      (args) => String(args[0]).includes("/api/openrouter") && args[1]?.method === "POST"
    );
    expect(call).toBeTruthy();
    const body = JSON.parse(call?.[1]?.body as string) as { messages?: Array<{ content?: string }> };
    const userMessage = body.messages?.find((message) => message.content?.includes("Analyze this visible state"));
    expect(userMessage?.content).toContain('"lastTrick"');
  });

  it("falls back to Player labels when trick summary includes unknown ids", async () => {
    const lastTrick = {
      trickNumber: 4,
      winnerPlayerId: "ghost",
      winnerTeamId: "teamA",
      winningCard: makeCard("clubs", "A"),
      points: 6,
      plays: [{ playerId: "ghost", card: makeCard("clubs", "A") }],
    };
    mockedUseGameController.mockReturnValue(
      baseControllerState({
        gameState: makeGameState({ currentPlayerId: "ghost", lastTrick }),
        trickResolution: { pending: true, open: true, summary: lastTrick },
      })
    );

    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    expect(latestSidebarProps.gameState.currentPlayerId).toBe("ghost");
  });

  it("auto-acknowledges trick resolution when trick 8 resolves", async () => {
    const onAcknowledgeTrickResolution = vi.fn();
    const lastTrick = {
      trickNumber: 8,
      winnerPlayerId: "player1",
      winnerTeamId: "teamA",
      winningCard: makeCard("spades", "J"),
      points: 5,
      plays: [{ playerId: "player1", card: makeCard("spades", "J") }],
    };
    mockedUseGameController.mockReturnValue(
      baseControllerState({
        onAcknowledgeTrickResolution,
        trickResolution: { pending: true, open: true, summary: lastTrick },
        gameState: makeGameState({ lastTrick }),
      })
    );

    const { default: GamePage } = await import("@/app/game/page");
    render(<GamePage />);

    await waitFor(() => {
      expect(onAcknowledgeTrickResolution).toHaveBeenCalled();
    });
  });
});

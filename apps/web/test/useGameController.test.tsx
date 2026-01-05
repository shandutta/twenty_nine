import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createGameState, getLegalPlays } from "@twentynine/engine";
import type { Card } from "@twentynine/engine";
import { useGameController } from "@/components/game/use-game-controller";

const cardKey = (card: Card) => `${card.rank}-${card.suit}`;
const STORAGE_KEY = "twentynine:game-state:v1";

describe("useGameController", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("bots only play legal moves", async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(12345);

    const { result } = renderHook(() => useGameController());

    let safety = 0;
    while (result.current.engineState.phase !== "playing" && safety < 25) {
      if (result.current.engineState.phase === "bidding" && result.current.engineState.currentPlayer === 0) {
        await act(async () => {
          result.current.onPassBid();
        });
      }
      if (result.current.engineState.phase === "choose-trump" && result.current.engineState.currentPlayer === 0) {
        await act(async () => {
          result.current.onChooseTrump("spades");
        });
      }
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      safety += 1;
    }

    expect(result.current.engineState.phase).toBe("playing");

    if (result.current.engineState.currentPlayer === 0) {
      const firstLegalId = result.current.legalCardIds[0];
      expect(firstLegalId).toBeTruthy();
      const humanCard = result.current.gameState.players[0].cards.find((card) => card.id === firstLegalId)!;

      await act(async () => {
        result.current.onPlayCard(humanCard);
      });
    }

    const botPlayer = result.current.engineState.currentPlayer;
    const botLegal = getLegalPlays(result.current.engineState.hands[botPlayer], result.current.engineState.trick);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const botPlay = result.current.engineState.trick.plays.find((play) => play.player === botPlayer);
    expect(botPlay).toBeTruthy();
    expect(botLegal.map(cardKey)).toContain(cardKey(botPlay!.card));
  });

  it("uses LLM suggestion when enabled and valid", async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(2222);

    let chosen: Card | null = null;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        message: {
          content: chosen ? JSON.stringify({ rank: chosen.rank, suit: chosen.suit }) : '{"rank":"7","suit":"clubs"}',
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useGameController());

    act(() => {
      result.current.setBotEnabled(true);
      result.current.setBotDifficulty("hard");
    });

    let safety = 0;
    while (result.current.engineState.phase !== "playing" && safety < 25) {
      if (result.current.engineState.phase === "bidding" && result.current.engineState.currentPlayer === 0) {
        await act(async () => {
          result.current.onPassBid();
        });
      }
      if (result.current.engineState.phase === "choose-trump" && result.current.engineState.currentPlayer === 0) {
        await act(async () => {
          result.current.onChooseTrump("hearts");
        });
      }
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      safety += 1;
    }

    expect(result.current.engineState.phase).toBe("playing");

    if (result.current.engineState.currentPlayer === 0) {
      const firstLegalId = result.current.legalCardIds[0];
      const humanCard = result.current.gameState.players[0].cards.find((card) => card.id === firstLegalId)!;

      await act(async () => {
        result.current.onPlayCard(humanCard);
      });
    }

    const botPlayer = result.current.engineState.currentPlayer;
    const botLegal = getLegalPlays(result.current.engineState.hands[botPlayer], result.current.engineState.trick);
    chosen = botLegal[0] ?? null;

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const botPlay = result.current.engineState.trick.plays.find((play) => play.player === botPlayer);
    expect(botPlay).toBeTruthy();
    expect(fetchMock).toHaveBeenCalled();
    if (chosen) {
      expect(cardKey(botPlay!.card)).toBe(cardKey(chosen));
    }
  });

  it("maps reasoning effort to difficulty defaults", async () => {
    vi.useRealTimers();

    const { result } = renderHook(() => useGameController());

    await waitFor(() => {
      expect(result.current.botSettings.reasoningEffort).toBe("low");
    });

    await act(async () => {
      result.current.setBotDifficulty("hard");
    });

    await waitFor(() => {
      expect(result.current.botSettings.reasoningEffort).toBe("high");
    });

    await act(async () => {
      result.current.setBotDifficulty("medium");
    });

    await waitFor(() => {
      expect(result.current.botSettings.reasoningEffort).toBe("medium");
    });
  });

  it("sends reasoning effort in the LLM request", async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(3333);

    let chosen: Card | null = null;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        message: {
          content: chosen ? JSON.stringify({ rank: chosen.rank, suit: chosen.suit }) : '{"rank":"7","suit":"clubs"}',
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useGameController());

    act(() => {
      result.current.setBotEnabled(true);
    });

    let safety = 0;
    while (result.current.engineState.phase !== "playing" && safety < 25) {
      if (result.current.engineState.phase === "bidding" && result.current.engineState.currentPlayer === 0) {
        await act(async () => {
          result.current.onPassBid();
        });
      }
      if (result.current.engineState.phase === "choose-trump" && result.current.engineState.currentPlayer === 0) {
        await act(async () => {
          result.current.onChooseTrump("diamonds");
        });
      }
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      safety += 1;
    }

    expect(result.current.engineState.phase).toBe("playing");

    if (result.current.engineState.currentPlayer === 0) {
      const firstLegalId = result.current.legalCardIds[0];
      const humanCard = result.current.gameState.players[0].cards.find((card) => card.id === firstLegalId)!;

      await act(async () => {
        result.current.onPlayCard(humanCard);
      });
    }

    const botPlayer = result.current.engineState.currentPlayer;
    const botLegal = getLegalPlays(result.current.engineState.hands[botPlayer], result.current.engineState.trick);
    chosen = botLegal[0] ?? null;

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.reasoning).toMatchObject({ effort: "low" });
  });

  it("includes known trump, rules, and seen cards in the LLM prompt", async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(4444);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        message: {
          content: '{"rank":"J","suit":"spades"}',
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const base = createGameState({
      seed: 77,
      phase: "playing",
      bidderPlayer: 2,
      bidTarget: 16,
      trumpSuit: "spades",
    });

    const engineState = {
      ...base,
      currentPlayer: 2,
      leader: 2,
      trickNumber: 5,
      trumpRevealed: false,
      trumpFromSeventh: false,
      bidderTeam: 0,
      points: [10, 4],
      hands: base.hands.map((hand, idx) =>
        idx === 2
          ? [
              { rank: "J", suit: "spades" },
              { rank: "9", suit: "spades" },
              { rank: "Q", suit: "spades" },
            ]
          : hand
      ),
      log: [
        "Hand start. Dealer: P1.",
        "P1 played 7 of spades.",
        "P2 played 8 of spades.",
        "P3 played A of hearts.",
        "P4 played 10 of diamonds.",
        "P1 played 9 of clubs.",
      ],
    };

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        engineState,
        lastMove: null,
        botEnabled: true,
        botDifficulty: "hard",
        botModel: "openai/gpt-5.2-chat",
        botTemperature: 0.4,
        reasoningEffort: "high",
        controlMode: "standard",
      })
    );

    renderHook(() => useGameController());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const prompt = requestBody.messages?.[1]?.content as string;
    expect(prompt).toContain("Trump: spades (known to you, not revealed).");
    expect(prompt).toContain("Rank order J > 9 > A > 10 > K > Q > 8 > 7");
    expect(prompt).toContain("Last trick bonus: +1");
    expect(prompt).toContain("Seen cards by suit:");
    expect(prompt).toContain("spades [8, 7]");
    expect(prompt).toContain("hearts [A]");
    expect(prompt).toContain("diamonds [10]");
    expect(prompt).toContain("clubs [9]");
    expect(prompt).toContain("Seen trump ranks: 8, 7.");
    expect(prompt).toContain("Outstanding trump ranks (excluding your hand): A, 10, K.");
  });

  it("hydrates from localStorage when a snapshot exists", async () => {
    vi.useRealTimers();

    const snapshot = createGameState({ seed: 999, phase: "playing", trumpSuit: "spades", bidTarget: 16 });
    const persisted = {
      version: 1,
      engineState: { ...snapshot, currentPlayer: 0 },
      lastMove: null,
      botEnabled: false,
      botDifficulty: "hard",
      botModel: "openai/gpt-5.2",
      botTemperature: 0.42,
      reasoningEffort: "minimal",
      controlMode: "single-hand",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));

    const { result } = renderHook(() => useGameController());

    await waitFor(() => {
      expect(result.current.engineState.seed).toBe(999);
    });

    expect(result.current.botSettings.enabled).toBe(false);
    expect(result.current.botSettings.difficulty).toBe("hard");
    expect(result.current.botSettings.model).toBe("openai/gpt-5.2");
    expect(result.current.botSettings.temperature).toBe(0.42);
    expect(result.current.botSettings.reasoningEffort).toBe("minimal");
    expect(result.current.controlMode).toBe("single-hand");
    expect(result.current.controlModeLocked).toBe(true);
  });

  it("defaults reasoning effort from difficulty when missing in storage", async () => {
    vi.useRealTimers();

    const snapshot = createGameState({ seed: 555, phase: "playing", trumpSuit: "clubs", bidTarget: 16 });
    const persisted = {
      version: 1,
      engineState: { ...snapshot, currentPlayer: 0 },
      lastMove: null,
      botEnabled: false,
      botDifficulty: "hard",
      botModel: "openai/gpt-5.2-chat",
      botTemperature: 0.25,
      controlMode: "standard",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));

    const { result } = renderHook(() => useGameController());

    await waitFor(() => {
      expect(result.current.engineState.seed).toBe(555);
    });

    expect(result.current.botSettings.reasoningEffort).toBe("high");
  });

  it("persists updates to localStorage after hydration", async () => {
    vi.useRealTimers();

    const { result } = renderHook(() => useGameController());

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy();
    });

    await act(async () => {
      result.current.setBotEnabled(false);
      result.current.setBotDifficulty("medium");
    });

    await waitFor(() => {
      expect(result.current.botSettings.reasoningEffort).toBe("medium");
    });

    await act(async () => {
      result.current.setReasoningEffort("low");
    });

    await waitFor(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      expect(raw).toBeTruthy();
      const saved = JSON.parse(raw as string) as {
        botEnabled?: boolean;
        botDifficulty?: string;
        reasoningEffort?: string;
      };
      expect(saved.botEnabled).toBe(false);
      expect(saved.botDifficulty).toBe("medium");
      expect(saved.reasoningEffort).toBe("low");
    });
  });

  it("unblocks the next hand after acknowledging the final trick", async () => {
    vi.useRealTimers();

    const { result, rerender } = renderHook(() => useGameController());

    await waitFor(() => {
      expect(result.current.engineState.phase).toBe("bidding");
    });

    act(() => {
      const state = result.current.engineState;
      const winningCard = state.hands[0]?.[0] ?? { rank: "J", suit: "spades" };
      // Simulate a just-finished final trick without running the full hand.
      Object.assign(state, {
        phase: "hand-complete",
        matchWinner: null,
        trickNumber: 8,
        lastTrickWinnerTeam: 0,
        lastTrick: {
          number: 8,
          winner: 0,
          card: winningCard,
          points: 5,
          team: 0,
          plays: [{ player: 0, card: winningCard }],
        },
      });
    });

    rerender();

    expect(result.current.trickResolution.pending).toBe(true);
    expect(result.current.canStartNextHand).toBe(false);

    act(() => {
      result.current.onAcknowledgeTrickResolution();
    });

    await waitFor(() => {
      expect(result.current.canStartNextHand).toBe(true);
    });
  });

  it("locks control mode after a user switch", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useGameController());
    expect(result.current.controlMode).toBe("standard");
    expect(result.current.controlModeLocked).toBe(false);

    await act(async () => {
      result.current.onControlModeChange("single-hand");
    });

    expect(result.current.controlMode).toBe("single-hand");
    expect(result.current.controlModeLocked).toBe(true);
  });
});

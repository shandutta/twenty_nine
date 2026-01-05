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

  it("records reasoning trace when enabled", async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(3333);

    const reasoningText = "Summary: Preserve trump control; avoid dumping points.";
    let chosen: Card | null = null;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        message: {
          content: chosen ? JSON.stringify({ rank: chosen.rank, suit: chosen.suit }) : '{"rank":"7","suit":"clubs"}',
          reasoning: reasoningText,
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useGameController());

    act(() => {
      result.current.setBotEnabled(true);
      result.current.setShowReasoningTrace(true);
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
    expect(requestBody.reasoning).toMatchObject({ effort: "high", exclude: false });
    expect(result.current.llmReasoning).toContain("Summary");
  });

  it("hydrates from localStorage when a snapshot exists", async () => {
    vi.useFakeTimers();

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
      showReasoningTrace: true,
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
    expect(result.current.botSettings.showReasoningTrace).toBe(true);
    expect(result.current.controlMode).toBe("single-hand");
    expect(result.current.controlModeLocked).toBe(true);
  });

  it("persists updates to localStorage after hydration", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useGameController());

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy();
    });

    await act(async () => {
      result.current.setBotEnabled(false);
      result.current.setBotDifficulty("medium");
      result.current.setReasoningEffort("low");
      result.current.setShowReasoningTrace(true);
    });

    await waitFor(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      expect(raw).toBeTruthy();
      const saved = JSON.parse(raw as string) as {
        botEnabled?: boolean;
        botDifficulty?: string;
        reasoningEffort?: string;
        showReasoningTrace?: boolean;
      };
      expect(saved.botEnabled).toBe(false);
      expect(saved.botDifficulty).toBe("medium");
      expect(saved.reasoningEffort).toBe("low");
      expect(saved.showReasoningTrace).toBe(true);
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

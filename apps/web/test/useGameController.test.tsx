import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { getLegalPlays } from "@twentynine/engine";
import type { Card } from "@twentynine/engine";
import { useGameController } from "@/components/game/use-game-controller";

const cardKey = (card: Card) => `${card.rank}-${card.suit}`;

describe("useGameController", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("bots only play legal moves", async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(12345);

    const { result } = renderHook(() => useGameController());

    const firstLegalId = result.current.legalCardIds[0];
    expect(firstLegalId).toBeTruthy();
    const humanCard = result.current.gameState.players[0].cards.find((card) => card.id === firstLegalId)!;

    await act(async () => {
      result.current.onPlayCard(humanCard);
    });

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

    const firstLegalId = result.current.legalCardIds[0];
    const humanCard = result.current.gameState.players[0].cards.find((card) => card.id === firstLegalId)!;

    await act(async () => {
      result.current.onPlayCard(humanCard);
    });

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
});

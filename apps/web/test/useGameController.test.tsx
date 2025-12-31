import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useGameController } from "@/hooks/useGameController";
import type { Card, Action } from "@twentynine/engine";

const cardKey = (card: Card) => `${card.rank}-${card.suit}`;

const isPlayCard = (
  action: Action
): action is Extract<Action, { type: "play_card" }> =>
  action.type === "play_card";

const lastBotPlay = (actions: Action[]) =>
  actions.filter(isPlayCard).filter((action) => action.player === 1).at(-1);

describe("useGameController", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("bots only play legal moves", async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(12345);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ configured: true }) }))
    );

    const { result } = renderHook(() => useGameController());

    const firstLegal = result.current.legalMoves[0];
    expect(firstLegal).toBeTruthy();

    await act(async () => {
      result.current.playCard(firstLegal!);
    });

    const botLegal = result.current.legalMoves.map(cardKey);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    const botAction = lastBotPlay(result.current.state.actionLog);
    expect(botAction).toBeTruthy();
    expect(botLegal).toContain(cardKey(botAction!.card));
  });

  it("uses LLM suggestion when enabled and valid", async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(2222);

    let chosen: Card | null = null;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        message: {
          content: chosen
            ? JSON.stringify({ rank: chosen.rank, suit: chosen.suit })
            : "{\"rank\":\"7\",\"suit\":\"clubs\"}",
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useGameController());

    act(() => {
      result.current.setBotEnabled(true);
      result.current.setBotDifficulty("hard");
    });

    const humanCard = result.current.legalMoves[0];
    expect(humanCard).toBeTruthy();
    await act(async () => {
      result.current.playCard(humanCard!);
    });

    chosen = result.current.legalMoves[0]!;

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    const botAction = lastBotPlay(result.current.state.actionLog);
    expect(botAction).toBeTruthy();
    expect(cardKey(botAction!.card)).toBe(cardKey(chosen));
  });
});

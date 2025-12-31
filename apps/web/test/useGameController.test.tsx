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
});

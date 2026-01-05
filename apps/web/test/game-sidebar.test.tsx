import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GameSidebar } from "@/components/game/sidebar";
import type { GameState, PlayingCard } from "@/components/game/types";
import type { BotSettings } from "@/components/game/use-game-controller";

const makeCard = (suit: PlayingCard["suit"], rank: PlayingCard["rank"]): PlayingCard => ({
  suit,
  rank,
  id: `${suit}-${rank}`,
});

const makeGameState = (log: string[] = []): GameState => ({
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
  log,
  lastTrick: null,
});

const baseBotSettings: BotSettings = {
  enabled: false,
  difficulty: "easy",
  model: "openai/gpt-5.2-chat",
  fallbackModels: ["anthropic/claude-opus-4.5", "google/gemini-3-pro-preview"],
  temperature: 0.2,
  usageHint: "Conservative: protects high-value points and plays safely.",
  reasoningEffort: "high",
  showReasoningTrace: false,
};

describe("GameSidebar", () => {
  it("shows the full trick log when easy mode is enabled", async () => {
    render(
      <GameSidebar
        gameState={makeGameState(["P1 played 7H."])}
        onNewGame={vi.fn()}
        onOpenSettings={vi.fn()}
        easyMode={true}
        botSettings={baseBotSettings}
        onBotEnabledChange={vi.fn()}
        onBotDifficultyChange={vi.fn()}
        onBotModelChange={vi.fn()}
        onBotTemperatureChange={vi.fn()}
        onReasoningEffortChange={vi.fn()}
        onShowReasoningTraceChange={vi.fn()}
        controlMode="standard"
        onControlModeChange={vi.fn()}
        controlModeLocked={false}
        coachEnabled={false}
        onCoachEnabledChange={vi.fn()}
        coachLoading={false}
        coachError={null}
        coachResponse={null}
        onRequestCoach={vi.fn()}
        lastMoveSummary="No moves yet."
        legalAlternatives="--"
        canRequestCoach={false}
        bidOptions={[]}
        canBid={false}
        onPlaceBid={vi.fn()}
        onPassBid={vi.fn()}
        canChooseTrump={false}
        onChooseTrump={vi.fn()}
        onChooseTrumpFromSeventh={vi.fn()}
      />
    );

    const logTab = await screen.findByRole("tab", { name: /log/i });
    fireEvent.mouseDown(logTab, { button: 0 });

    expect(await screen.findByText(/Full trick log/i)).toBeInTheDocument();
    expect(screen.getByText(/You played 7H/i)).toBeInTheDocument();
  });
});

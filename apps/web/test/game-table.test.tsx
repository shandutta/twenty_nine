import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameTable } from "@/components/game/table";
import type { GameState, PlayingCard } from "@/components/game/types";

const makeCard = (suit: PlayingCard["suit"], rank: PlayingCard["rank"]): PlayingCard => ({
  suit,
  rank,
  id: `${suit}-${rank}`,
});

const makeGameState = (): GameState => ({
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
      tricksWon: 5,
      bid: 16,
      bidWinner: "player1",
      gameScore: 0,
      handPoints: 16,
    },
    teamB: {
      id: "teamB",
      name: "West & East",
      players: ["player2", "player4"],
      tricksWon: 3,
      gameScore: 0,
      handPoints: 13,
    },
  },
  trumpSuit: "spades",
  trumpRevealed: true,
  currentTrick: [],
  phase: "finished",
  currentBid: 16,
  bidWinner: "player1",
  royalsDeclaredBy: null,
  royalsAdjustment: 4,
  royalsMinTarget: 16,
  royalsMaxTarget: 29,
  roundNumber: 1,
  matchRound: 1,
  matchRedPips: [6, 2],
  matchBlackPips: [0, 1],
  matchWinner: "teamA",
  matchEndReason: "red",
  trickNumber: 8,
  currentPlayerId: "player1",
  log: [],
  lastTrick: null,
});

describe("GameTable", () => {
  it("renders the match winner overlay when a match is complete", () => {
    render(
      <GameTable
        gameState={makeGameState()}
        onPlayCard={vi.fn()}
        legalCardIds={[]}
        animationsEnabled={false}
        controlMode="standard"
        onControlModeChange={vi.fn()}
        controlModeLocked={true}
        bidOptions={[]}
        canBid={false}
        onPlaceBid={vi.fn()}
        onPassBid={vi.fn()}
        canChooseTrump={false}
        onChooseTrump={vi.fn()}
        onChooseTrumpFromSeventh={vi.fn()}
        onNewGame={vi.fn()}
        onNextHand={vi.fn()}
        canStartNextHand={false}
        canRevealTrump={false}
        onRevealTrump={vi.fn()}
        canDeclareRoyals={false}
        onDeclareRoyals={vi.fn()}
        llmInUse={false}
        llmReasoning={null}
        llmReasoningMeta={null}
        showReasoningTrace={false}
      />
    );

    expect(screen.getByText("Match Complete")).toBeInTheDocument();
    expect(screen.getByText(/wins the table/i)).toBeInTheDocument();
  });
});

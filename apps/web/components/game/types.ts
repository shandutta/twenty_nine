export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "J" | "9" | "A" | "10" | "K" | "Q" | "8" | "7";

export interface PlayingCard {
  suit: Suit;
  rank: Rank;
  id: string;
}

export interface Team {
  id: "teamA" | "teamB";
  name: string;
  players: string[];
  tricksWon: number;
  bid?: number;
  bidWinner?: string;
  gameScore: number;
  handPoints: number;
}

export interface Player {
  id: string;
  name: string;
  position: "bottom" | "left" | "top" | "right";
  cards: PlayingCard[];
  isCurrentPlayer: boolean;
  teamId: "teamA" | "teamB";
}

export interface GameState {
  players: Player[];
  teams: {
    teamA: Team;
    teamB: Team;
  };
  trumpSuit: Suit | null;
  trumpRevealed: boolean;
  currentTrick: { playerId: string; card: PlayingCard }[];
  phase: "playing" | "finished";
  currentBid: number;
  bidWinner: string | null;
  roundNumber: number;
  trickNumber: number;
  currentPlayerId: string;
  log: string[];
}

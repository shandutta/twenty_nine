export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"] as const;
export type Rank = (typeof RANKS)[number];

export const RANK_ORDER = ["J", "9", "A", "10", "K", "Q", "8", "7"] as const;

const RANK_POWER: Record<Rank, number> = {
  J: 7,
  "9": 6,
  A: 5,
  "10": 4,
  K: 3,
  Q: 2,
  "8": 1,
  "7": 0,
};

const RANK_POINTS: Record<Rank, number> = {
  J: 3,
  "9": 2,
  A: 1,
  "10": 1,
  K: 0,
  Q: 0,
  "8": 0,
  "7": 0,
};

export type Card = {
  suit: Suit;
  rank: Rank;
};

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
};

export const compareRanks = (a: Rank, b: Rank): number => {
  return Math.sign(RANK_POWER[a] - RANK_POWER[b]);
};

export const rankPoints = (rank: Rank): number => RANK_POINTS[rank];

export const cardPoints = (card: Card): number => rankPoints(card.rank);

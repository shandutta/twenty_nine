export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export type Suit = (typeof SUITS)[number];
export const JOKER_SUIT = "joker" as const;
export type CardSuit = Suit | typeof JOKER_SUIT;

export const RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"] as const;
export const JOKER_RANK = "Joker" as const;
export type Rank = (typeof RANKS)[number] | typeof JOKER_RANK;

export const RANK_ORDER = [
  JOKER_RANK,
  "J",
  "9",
  "A",
  "10",
  "K",
  "Q",
  "8",
  "7",
] as const;

const RANK_POWER: Record<Rank, number> = {
  [JOKER_RANK]: 8,
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
  [JOKER_RANK]: 0,
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
  suit: CardSuit;
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

export const addJokerToDeck = (
  deck: Card[],
  trumpSuit: Suit | null,
): Card[] => {
  const replacementSuit = trumpSuit ?? "spades";
  const index = deck.findIndex(
    (card) => card.suit === replacementSuit && card.rank === "7",
  );
  if (index === -1) {
    throw new Error("Cannot add Joker: missing 7 for replacement.");
  }
  const next = deck.slice();
  next[index] = { suit: JOKER_SUIT, rank: JOKER_RANK };
  return next;
};

export const compareRanks = (a: Rank, b: Rank): number => {
  return Math.sign(RANK_POWER[a] - RANK_POWER[b]);
};

export const rankPoints = (rank: Rank): number => RANK_POINTS[rank];

export const cardPoints = (card: Card): number => rankPoints(card.rank);

import { cardPoints, compareRanks } from "./cards";
import type { Card, Suit } from "./cards";

export type TrickPlay = {
  player: number;
  card: Card;
};

export type TrickState = {
  plays: TrickPlay[];
};

export const createTrick = (): TrickState => ({ plays: [] });

export const leadSuit = (trick: TrickState): Suit | null => {
  return trick.plays.length === 0 ? null : trick.plays[0].card.suit;
};

export const getLegalPlays = (hand: Card[], trick: TrickState): Card[] => {
  const lead = leadSuit(trick);
  if (!lead) return hand;
  const follow = hand.filter((card) => card.suit === lead);
  return follow.length > 0 ? follow : hand;
};

export const isLegalPlay = (
  hand: Card[],
  trick: TrickState,
  card: Card,
): boolean => {
  const legal = getLegalPlays(hand, trick);
  return legal.some(
    (candidate) =>
      candidate.suit === card.suit && candidate.rank === card.rank,
  );
};

export const shouldRevealTrump = (
  hand: Card[],
  trick: TrickState,
): boolean => {
  const lead = leadSuit(trick);
  if (!lead) return false;
  return hand.every((card) => card.suit !== lead);
};

export const playCard = ({
  trick,
  hand,
  player,
  card,
  trumpRevealed,
}: {
  trick: TrickState;
  hand: Card[];
  player: number;
  card: Card;
  trumpRevealed: boolean;
}): { trick: TrickState; trumpRevealed: boolean } => {
  if (!isLegalPlay(hand, trick, card)) {
    throw new Error("Illegal play: must follow suit if possible.");
  }

  const revealNow = !trumpRevealed && shouldRevealTrump(hand, trick);

  return {
    trick: { plays: [...trick.plays, { player, card }] },
    trumpRevealed: trumpRevealed || revealNow,
  };
};

const highestByRank = (plays: TrickPlay[]): TrickPlay => {
  return plays.reduce((best, current) => {
    return compareRanks(current.card.rank, best.card.rank) > 0 ? current : best;
  });
};

export const winningPlay = (
  trick: TrickState,
  trumpSuit: Suit,
  trumpRevealed: boolean,
): TrickPlay => {
  if (trick.plays.length === 0) {
    throw new Error("Cannot determine winner of an empty trick.");
  }

  const lead = leadSuit(trick);
  if (!lead) {
    throw new Error("Trick has no lead suit.");
  }

  if (trumpRevealed) {
    const trumps = trick.plays.filter((play) => play.card.suit === trumpSuit);
    if (trumps.length > 0) {
      return highestByRank(trumps);
    }
  }

  const leadSuitPlays = trick.plays.filter(
    (play) => play.card.suit === lead,
  );
  return highestByRank(leadSuitPlays);
};

export const trickPoints = (trick: TrickState): number => {
  return trick.plays.reduce((sum, play) => sum + cardPoints(play.card), 0);
};

export const scoreTrick = (
  trick: TrickState,
  isLastTrick: boolean,
): number => {
  return trickPoints(trick) + (isLastTrick ? 1 : 0);
};

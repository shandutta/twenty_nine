import type { Card, Suit } from "./cards";
import type { EngineConfig } from "./config";

export type TeamId = 0 | 1;

export const hasRoyals = (hand: Card[], trumpSuit: Suit): boolean => {
  let hasKing = false;
  let hasQueen = false;
  for (const card of hand) {
    if (card.suit !== trumpSuit) continue;
    if (card.rank === "K") hasKing = true;
    if (card.rank === "Q") hasQueen = true;
  }
  return hasKing && hasQueen;
};

export const canDeclareRoyals = ({
  hand,
  trumpSuit,
  trumpRevealed,
  lastTrickWinnerTeam,
  declarerTeam,
}: {
  hand: Card[];
  trumpSuit: Suit;
  trumpRevealed: boolean;
  lastTrickWinnerTeam: TeamId;
  declarerTeam: TeamId;
}): boolean => {
  if (!trumpRevealed) return false;
  if (lastTrickWinnerTeam !== declarerTeam) return false;
  return hasRoyals(hand, trumpSuit);
};

export const adjustBidTargetForRoyals = ({
  currentTarget,
  declarerTeam,
  bidderTeam,
  config,
}: {
  currentTarget: number;
  declarerTeam: TeamId;
  bidderTeam: TeamId;
  config: EngineConfig;
}): number => {
  const adjustment = config.royalsAdjustment;
  if (declarerTeam === bidderTeam) {
    return Math.max(config.minBid, currentTarget - adjustment);
  }
  return Math.min(config.maxBidTarget, currentTarget + adjustment);
};

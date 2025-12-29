import { cardPoints, compareRanks, createDeck } from "./cards";
import type { Card, Suit } from "./cards";
import { createTrick, getLegalPlays, playCard, winningPlay } from "./trick";
import type { TrickState } from "./trick";
import { adjustBidTargetForRoyals, canDeclareRoyals } from "./royals";
import type { TeamId } from "./royals";
import type { EngineConfig } from "./config";

export type GamePhase = "playing" | "hand-complete";

export type GameState = {
  hands: Card[][];
  trick: TrickState;
  trickNumber: number;
  leader: number;
  currentPlayer: number;
  trumpSuit: Suit;
  trumpRevealed: boolean;
  points: [number, number];
  tricksWon: [number, number];
  bidderTeam: TeamId;
  bidTarget: number;
  lastTrickWinnerTeam: TeamId | null;
  royalsDeclaredBy: TeamId | null;
  phase: GamePhase;
  log: string[];
  seed: number;
  config: EngineConfig;
};

export type GameAction =
  | { type: "playCard"; player: number; card: Card }
  | { type: "declareRoyals"; player: number };

const DEFAULT_CONFIG: EngineConfig = {
  minBid: 16,
  maxBidTarget: 29,
  royalsAdjustment: 4,
};

const nextPlayer = (player: number): number => (player + 1) % 4;

export const teamForPlayer = (player: number): TeamId =>
  player % 2 === 0 ? 0 : 1;

const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

export const shuffleDeck = (deck: Card[], seed: number): Card[] => {
  const rng = createRng(seed);
  const cards = deck.slice();
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
};

const dealHands = (deck: Card[]): Card[][] => {
  const hands: Card[][] = [[], [], [], []];
  deck.forEach((card, index) => {
    hands[index % 4].push(card);
  });
  return hands;
};

const cardLabel = (card: Card): string => `${card.rank} of ${card.suit}`;

export const createGameState = ({
  seed,
  dealer = 0,
  bidderTeam = 0,
  bidTarget = 16,
  trumpSuit,
  config = DEFAULT_CONFIG,
}: {
  seed: number;
  dealer?: number;
  bidderTeam?: TeamId;
  bidTarget?: number;
  trumpSuit?: Suit;
  config?: EngineConfig;
}): GameState => {
  const deck = shuffleDeck(createDeck(), seed);
  const chosenTrump = trumpSuit ?? deck[0].suit;
  const hands = dealHands(deck);
  const leader = nextPlayer(dealer);

  return {
    hands,
    trick: createTrick(),
    trickNumber: 0,
    leader,
    currentPlayer: leader,
    trumpSuit: chosenTrump,
    trumpRevealed: false,
    points: [0, 0],
    tricksWon: [0, 0],
    bidderTeam,
    bidTarget,
    lastTrickWinnerTeam: null,
    royalsDeclaredBy: null,
    phase: "playing",
    log: [`Hand start. Dealer: P${dealer + 1}.`],
    seed,
    config,
  };
};

const rankTieBreaker = (a: Card, b: Card): number => {
  const rankDiff = compareRanks(a.rank, b.rank);
  if (rankDiff !== 0) return rankDiff;
  return 0;
};

export const chooseBotCard = ({
  hand,
  trick,
}: {
  hand: Card[];
  trick: TrickState;
}): Card => {
  const legal = getLegalPlays(hand, trick);
  if (legal.length === 1) return legal[0];

  const byPoints = legal.slice().sort((a, b) => {
    const pointDiff = cardPoints(b) - cardPoints(a);
    if (pointDiff !== 0) return pointDiff;
    return rankTieBreaker(b, a);
  });

  return byPoints[0];
};

export const reduceGame = (state: GameState, action: GameAction): GameState => {
  if (action.type === "declareRoyals") {
    if (state.phase !== "playing") return state;
    const declarerTeam = teamForPlayer(action.player);
    if (state.royalsDeclaredBy !== null) return state;
    if (state.lastTrickWinnerTeam === null) return state;
    const hand = state.hands[action.player];
    if (
      !canDeclareRoyals({
        hand,
        trumpSuit: state.trumpSuit,
        trumpRevealed: state.trumpRevealed,
        lastTrickWinnerTeam: state.lastTrickWinnerTeam,
        declarerTeam,
      })
    ) {
      return state;
    }

    const newTarget = adjustBidTargetForRoyals({
      currentTarget: state.bidTarget,
      declarerTeam,
      bidderTeam: state.bidderTeam,
      config: state.config,
    });

    return {
      ...state,
      bidTarget: newTarget,
      royalsDeclaredBy: declarerTeam,
      log: [
        ...state.log,
        `Royals declared by Team ${declarerTeam + 1}. Bid target -> ${newTarget}.`,
      ],
    };
  }

  if (action.type !== "playCard") return state;
  if (state.phase !== "playing") {
    throw new Error("Hand is complete.");
  }

  if (action.player !== state.currentPlayer) {
    throw new Error("Not this player's turn.");
  }

  const hand = state.hands[action.player];
  const cardIndex = hand.findIndex(
    (card) =>
      card.suit === action.card.suit && card.rank === action.card.rank,
  );
  if (cardIndex === -1) {
    throw new Error("Card not found in hand.");
  }

  const { trick, trumpRevealed } = playCard({
    trick: state.trick,
    hand,
    player: action.player,
    card: action.card,
    trumpRevealed: state.trumpRevealed,
  });

  const nextHands = state.hands.map((cards, index) => {
    if (index !== action.player) return cards;
    return cards.filter(
      (card) =>
        card.suit !== action.card.suit || card.rank !== action.card.rank,
    );
  });

  const log = [
    ...state.log,
    `P${action.player + 1} played ${cardLabel(action.card)}.`,
  ];

  if (trumpRevealed && !state.trumpRevealed) {
    log.push("Trump revealed.");
  }

  if (trick.plays.length < 4) {
    return {
      ...state,
      hands: nextHands,
      trick,
      trumpRevealed,
      currentPlayer: nextPlayer(action.player),
      log,
    };
  }

  const winner = winningPlay(trick, state.trumpSuit, trumpRevealed);
  const winnerTeam = teamForPlayer(winner.player);
  const isLastTrick = state.trickNumber === 7;
  const trickScore = trick.plays.reduce(
    (sum, play) => sum + cardPoints(play.card),
    0,
  );
  const totalScore = trickScore + (isLastTrick ? 1 : 0);

  const points: [number, number] = [...state.points] as [number, number];
  points[winnerTeam] += totalScore;

  const tricksWon: [number, number] = [
    ...state.tricksWon,
  ] as [number, number];
  tricksWon[winnerTeam] += 1;

  log.push(
    `Trick ${state.trickNumber + 1} won by Team ${
      winnerTeam + 1
    } (+${totalScore}).`,
  );

  const nextTrickNumber = state.trickNumber + 1;
  const phase: GamePhase = nextTrickNumber >= 8 ? "hand-complete" : "playing";

  return {
    ...state,
    hands: nextHands,
    trick: createTrick(),
    trumpRevealed,
    leader: winner.player,
    currentPlayer: winner.player,
    trickNumber: nextTrickNumber,
    points,
    tricksWon,
    lastTrickWinnerTeam: winnerTeam,
    phase,
    log,
  };
};

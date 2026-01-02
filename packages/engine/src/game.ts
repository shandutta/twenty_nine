import { cardPoints, compareRanks, createDeck } from "./cards";
import type { Card, Suit } from "./cards";
import { createTrick, getLegalPlays, playCard, shouldRevealTrump, winningPlay } from "./trick";
import type { TrickState } from "./trick";
import { adjustBidTargetForRoyals, canDeclareRoyals } from "./royals";
import type { TeamId } from "./royals";
import type { EngineConfig } from "./config";

export type GamePhase = "bidding" | "choose-trump" | "playing" | "hand-complete";

export type GameState = {
  hands: Card[][];
  trick: TrickState;
  trickNumber: number;
  leader: number;
  currentPlayer: number;
  dealer: number;
  trumpSuit: Suit | null;
  trumpRevealed: boolean;
  points: [number, number];
  tricksWon: [number, number];
  bidderTeam: TeamId | null;
  bidderPlayer: number | null;
  bidTarget: number | null;
  bidPasses: number;
  bidHistory: { player: number; bid: number | null }[];
  lastTrickWinnerTeam: TeamId | null;
  lastTrick: {
    number: number;
    winner: number;
    card: Card;
    points: number;
    team: TeamId;
  } | null;
  royalsDeclaredBy: TeamId | null;
  phase: GamePhase;
  log: string[];
  seed: number;
  config: EngineConfig;
};

export type GameAction =
  | { type: "playCard"; player: number; card: Card }
  | { type: "placeBid"; player: number; amount: number }
  | { type: "passBid"; player: number }
  | { type: "chooseTrump"; player: number; suit: Suit }
  | { type: "declareRoyals"; player: number }
  | { type: "revealTrump"; player: number };

const DEFAULT_CONFIG: EngineConfig = {
  minBid: 16,
  maxBidTarget: 29,
  royalsAdjustment: 4,
  openingLead: "left-of-dealer",
};

const nextPlayer = (player: number): number => (player + 1) % 4;

const openingLeader = (dealer: number, bidderPlayer: number | null, config: EngineConfig): number => {
  if (config.openingLead === "bidder" && bidderPlayer !== null) {
    return bidderPlayer;
  }
  return nextPlayer(dealer);
};

export const teamForPlayer = (player: number): TeamId => (player % 2 === 0 ? 0 : 1);

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
  phase = "bidding",
  bidderPlayer = null,
  bidderTeam = null,
  bidTarget = null,
  trumpSuit = null,
  config = DEFAULT_CONFIG,
}: {
  seed: number;
  dealer?: number;
  phase?: GamePhase;
  bidderPlayer?: number | null;
  bidderTeam?: TeamId | null;
  bidTarget?: number | null;
  trumpSuit?: Suit | null;
  config?: EngineConfig;
}): GameState => {
  const deck = shuffleDeck(createDeck(), seed);
  const hands = dealHands(deck);
  const derivedBidderTeam = bidderTeam ?? (bidderPlayer !== null ? teamForPlayer(bidderPlayer) : null);
  const resolvedBidTarget =
    bidTarget ?? (phase === "playing" || phase === "hand-complete" ? config.minBid : null);
  const chosenTrump =
    trumpSuit ?? (phase === "playing" || phase === "hand-complete" ? deck[0].suit : null);
  const leader =
    phase === "playing" || phase === "hand-complete" ? openingLeader(dealer, bidderPlayer, config) : nextPlayer(dealer);
  const currentPlayer =
    phase === "bidding" ? nextPlayer(dealer) : phase === "choose-trump" ? bidderPlayer ?? nextPlayer(dealer) : leader;

  return {
    hands,
    trick: createTrick(),
    trickNumber: 0,
    leader,
    currentPlayer,
    dealer,
    trumpSuit: chosenTrump,
    trumpRevealed: false,
    points: [0, 0],
    tricksWon: [0, 0],
    bidderTeam: derivedBidderTeam,
    bidderPlayer,
    bidTarget: resolvedBidTarget,
    bidPasses: 0,
    bidHistory: [],
    lastTrickWinnerTeam: null,
    lastTrick: null,
    royalsDeclaredBy: null,
    phase,
    log:
      phase === "bidding"
        ? [`Hand start. Dealer: P${dealer + 1}.`, `Bidding begins with P${nextPlayer(dealer) + 1}.`]
        : [`Hand start. Dealer: P${dealer + 1}.`],
    seed,
    config,
  };
};

const rankTieBreaker = (a: Card, b: Card): number => {
  const rankDiff = compareRanks(a.rank, b.rank);
  if (rankDiff !== 0) return rankDiff;
  return 0;
};

export const chooseBotCard = ({ hand, trick }: { hand: Card[]; trick: TrickState }): Card => {
  const legal = getLegalPlays(hand, trick);
  if (legal.length === 1) return legal[0];

  const bySafety = legal.slice().sort((a, b) => {
    const pointDiff = cardPoints(a) - cardPoints(b);
    if (pointDiff !== 0) return pointDiff;
    return rankTieBreaker(a, b);
  });

  return bySafety[0];
};

const redealGame = (state: GameState, log: string[]): GameState => {
  const nextDealer = nextPlayer(state.dealer);
  const nextSeed = state.seed + 1;
  const fresh = createGameState({ seed: nextSeed, dealer: nextDealer, config: state.config });
  return {
    ...fresh,
    log: [...log, ...fresh.log],
  };
};

export const reduceGame = (state: GameState, action: GameAction): GameState => {
  if (action.type === "placeBid") {
    if (state.phase !== "bidding") return state;
    if (action.player !== state.currentPlayer) return state;

    const minBid = state.config.minBid;
    const maxBid = state.config.maxBidTarget;
    const current = state.bidTarget ?? null;
    const minRaise = current !== null ? current + 1 : minBid;

    if (action.amount < minBid || action.amount > maxBid) return state;
    if (action.amount < minRaise) return state;

    const log = [...state.log, `P${action.player + 1} bids ${action.amount}.`];
    const bidHistory = [...state.bidHistory, { player: action.player, bid: action.amount }];
    const nextState = {
      ...state,
      bidTarget: action.amount,
      bidderPlayer: action.player,
      bidderTeam: teamForPlayer(action.player),
      bidPasses: 0,
      bidHistory,
      currentPlayer: nextPlayer(action.player),
      log,
    };

    if (action.amount >= maxBid) {
      return {
        ...nextState,
        phase: "choose-trump",
        currentPlayer: action.player,
        log: [...log, `Bidding ends at ${action.amount}.`],
      };
    }

    return nextState;
  }

  if (action.type === "passBid") {
    if (state.phase !== "bidding") return state;
    if (action.player !== state.currentPlayer) return state;

    const bidPasses = state.bidPasses + 1;
    const log = [...state.log, `P${action.player + 1} passes.`];
    const bidHistory = [...state.bidHistory, { player: action.player, bid: null }];

    if (state.bidTarget === null && bidPasses >= 4) {
      return redealGame(state, [...log, "All players passed. Redealing."]);
    }

    if (state.bidTarget !== null && bidPasses >= 3 && state.bidderPlayer !== null) {
      return {
        ...state,
        bidPasses,
        bidHistory,
        phase: "choose-trump",
        currentPlayer: state.bidderPlayer,
        log: [...log, `Bidding won by P${state.bidderPlayer + 1} at ${state.bidTarget}.`],
      };
    }

    return {
      ...state,
      bidPasses,
      bidHistory,
      currentPlayer: nextPlayer(action.player),
      log,
    };
  }

  if (action.type === "chooseTrump") {
    if (state.phase !== "choose-trump") return state;
    if (action.player !== state.currentPlayer) return state;
    if (state.bidTarget === null || state.bidderPlayer === null || state.bidderTeam === null) return state;

    const leader = openingLeader(state.dealer, state.bidderPlayer, state.config);

    return {
      ...state,
      trumpSuit: action.suit,
      trumpRevealed: false,
      phase: "playing",
      leader,
      currentPlayer: leader,
      log: [...state.log, `Trump chosen by P${action.player + 1}: ${action.suit}.`],
    };
  }

  if (action.type === "declareRoyals") {
    if (state.phase !== "playing") return state;
    if (state.bidTarget === null || state.bidderTeam === null || state.trumpSuit === null) return state;
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
      log: [...state.log, `Royals declared by Team ${declarerTeam + 1}. Bid target -> ${newTarget}.`],
    };
  }

  if (action.type === "revealTrump") {
    if (state.phase !== "playing") return state;
    if (state.trumpSuit === null) return state;
    if (state.trumpRevealed) return state;
    if (action.player !== state.currentPlayer) return state;

    const hand = state.hands[action.player] ?? [];
    if (!shouldRevealTrump(hand, state.trick)) {
      return state;
    }

    return {
      ...state,
      trumpRevealed: true,
      log: [...state.log, `Trump revealed by P${action.player + 1}.`],
    };
  }

  if (action.type !== "playCard") return state;
  if (state.phase !== "playing") {
    throw new Error("Hand is not in play.");
  }
  if (state.trumpSuit === null) {
    throw new Error("Trump has not been chosen.");
  }

  if (action.player !== state.currentPlayer) {
    throw new Error("Not this player's turn.");
  }

  const hand = state.hands[action.player];
  const cardIndex = hand.findIndex((card) => card.suit === action.card.suit && card.rank === action.card.rank);
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
    return cards.filter((card) => card.suit !== action.card.suit || card.rank !== action.card.rank);
  });

  const log = [...state.log, `P${action.player + 1} played ${cardLabel(action.card)}.`];

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
  const trickScore = trick.plays.reduce((sum, play) => sum + cardPoints(play.card), 0);
  const totalScore = trickScore + (isLastTrick ? 1 : 0);

  const points: [number, number] = [...state.points] as [number, number];
  points[winnerTeam] += totalScore;

  const tricksWon: [number, number] = [...state.tricksWon] as [number, number];
  tricksWon[winnerTeam] += 1;

  log.push(`Trick ${state.trickNumber + 1} won by Team ${winnerTeam + 1} (+${totalScore}).`);

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
    lastTrick: {
      number: state.trickNumber + 1,
      winner: winner.player,
      card: winner.card,
      points: totalScore,
      team: winnerTeam,
    },
    phase,
    log,
  };
};

import { useEffect, useMemo, useReducer, useRef } from "react";
import {
  compareRanks,
  createDeck,
  createTrick,
  getLegalPlays,
  playCard,
  scoreTrick,
  winningPlay,
} from "@/lib/engine";
import type { Card, Suit, TrickState } from "@/lib/engine";

export type GameState = {
  hands: Card[][];
  trick: TrickState;
  trumpSuit: Suit;
  trumpRevealed: boolean;
  currentPlayer: number;
  trickIndex: number;
  scores: [number, number];
  log: string[];
  status: "playing" | "hand-complete";
};

type GameAction =
  | { type: "playCard"; player: number; card: Card }
  | { type: "botPlay" }
  | { type: "reset" };

const PLAYER_COUNT = 4;
const TRICKS_PER_HAND = 8;

const teamForPlayer = (player: number): 0 | 1 => (player % 2) as 0 | 1;

const shuffle = (cards: Card[]): Card[] => {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const deal = (deck: Card[]): Card[][] => {
  const hands: Card[][] = Array.from({ length: PLAYER_COUNT }, () => []);
  deck.forEach((card, index) => {
    hands[index % PLAYER_COUNT].push(card);
  });
  return hands;
};

const pickHighest = (cards: Card[]): Card => {
  return cards.reduce((best, current) => {
    return compareRanks(current.rank, best.rank) > 0 ? current : best;
  });
};

const pickLowest = (cards: Card[]): Card => {
  return cards.reduce((best, current) => {
    return compareRanks(current.rank, best.rank) < 0 ? current : best;
  });
};

const pickBotCard = (
  hand: Card[],
  trick: TrickState,
  trumpSuit: Suit,
  trumpRevealed: boolean,
): Card => {
  const legal = getLegalPlays(hand, trick);
  const lead = trick.plays[0]?.card.suit ?? null;
  const trumps = hand.filter((card) => card.suit === trumpSuit);

  if (!lead) {
    if (trumpRevealed) {
      const nonTrump = hand.filter((card) => card.suit !== trumpSuit);
      return nonTrump.length > 0 ? pickHighest(nonTrump) : pickHighest(hand);
    }
    return pickHighest(hand);
  }

  if (legal.length < hand.length) {
    return pickLowest(legal);
  }

  if (trumps.length > 0) {
    return pickHighest(trumps);
  }

  return pickLowest(hand);
};

const removeCard = (hand: Card[], card: Card): Card[] => {
  const index = hand.findIndex(
    (item) => item.rank === card.rank && item.suit === card.suit,
  );
  if (index === -1) return hand;
  const next = [...hand];
  next.splice(index, 1);
  return next;
};

const createInitialState = (): GameState => {
  const deck = shuffle(createDeck());
  const hands = deal(deck);
  const suits: Suit[] = ["clubs", "diamonds", "hearts", "spades"];
  const trumpSuit = suits[Math.floor(Math.random() * suits.length)];
  return {
    hands,
    trick: createTrick(),
    trumpSuit,
    trumpRevealed: false,
    currentPlayer: 0,
    trickIndex: 0,
    scores: [0, 0],
    log: ["New hand started."],
    status: "playing",
  };
};

const applyPlay = (state: GameState, player: number, card: Card): GameState => {
  if (state.status !== "playing") return state;
  if (player !== state.currentPlayer) return state;
  const hand = state.hands[player];
  if (!hand) return state;

  let nextTrick: TrickState;
  let nextTrumpRevealed: boolean;
  try {
    const result = playCard({
      trick: state.trick,
      hand,
      player,
      card,
      trumpRevealed: state.trumpRevealed,
    });
    nextTrick = result.trick;
    nextTrumpRevealed = result.trumpRevealed;
  } catch {
    return state;
  }

  const nextHands = state.hands.map((cards, index) => {
    return index === player ? removeCard(cards, card) : cards;
  });

  const log = [...state.log, `Player ${player + 1} played ${card.rank}${card.suit[0].toUpperCase()}.`];

  if (!state.trumpRevealed && nextTrumpRevealed) {
    log.push(`Trump revealed: ${state.trumpSuit}.`);
  }

  if (nextTrick.plays.length < PLAYER_COUNT) {
    return {
      ...state,
      hands: nextHands,
      trick: nextTrick,
      trumpRevealed: nextTrumpRevealed,
      currentPlayer: (player + 1) % PLAYER_COUNT,
      log,
    };
  }

  const winner = winningPlay(nextTrick, state.trumpSuit, nextTrumpRevealed);
  const winnerTeam = teamForPlayer(winner.player);
  const isLastTrick = state.trickIndex === TRICKS_PER_HAND - 1;
  const points = scoreTrick(nextTrick, isLastTrick);
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[winnerTeam] += points;

  const trickIndex = state.trickIndex + 1;
  log.push(
    `Trick ${state.trickIndex + 1} won by Player ${winner.player + 1} (+${points}).`,
  );

  const status = trickIndex >= TRICKS_PER_HAND ? "hand-complete" : "playing";
  if (status === "hand-complete") {
    log.push(`Hand complete. Team 1: ${scores[0]}, Team 2: ${scores[1]}.`);
  }

  return {
    ...state,
    hands: nextHands,
    trick: createTrick(),
    trumpRevealed: nextTrumpRevealed,
    currentPlayer: winner.player,
    trickIndex,
    scores,
    log,
    status,
  };
};

const reducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case "playCard":
      return applyPlay(state, action.player, action.card);
    case "botPlay": {
      const player = state.currentPlayer;
      if (player === 0 || state.status !== "playing") return state;
      const hand = state.hands[player];
      if (!hand || hand.length === 0) return state;
      const card = pickBotCard(hand, state.trick, state.trumpSuit, state.trumpRevealed);
      return applyPlay(state, player, card);
    }
    case "reset":
      return createInitialState();
    default:
      return state;
  }
};

export const useTwentyNineGame = () => {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const botTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (state.status !== "playing") return undefined;
    if (state.currentPlayer === 0) return undefined;
    if (botTimeout.current !== null) return undefined;

    botTimeout.current = window.setTimeout(() => {
      dispatch({ type: "botPlay" });
      botTimeout.current = null;
    }, 500);

    return () => {
      if (botTimeout.current !== null) {
        window.clearTimeout(botTimeout.current);
        botTimeout.current = null;
      }
    };
  }, [state.currentPlayer, state.status, state.trick.plays.length]);

  const legalPlays = useMemo(() => {
    return getLegalPlays(state.hands[0] ?? [], state.trick);
  }, [state.hands, state.trick]);

  const playCardForHuman = (card: Card) => {
    dispatch({ type: "playCard", player: 0, card });
  };

  const reset = () => dispatch({ type: "reset" });

  return { state, legalPlays, playCardForHuman, reset };
};

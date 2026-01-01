import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chooseBotCard, createGameState, getLegalPlays, leadSuit, reduceGame } from "@twentynine/engine";
import type { Card, GameAction, GameState as EngineState, Suit } from "@twentynine/engine";
import type { GameState, PlayingCard, Player, Team } from "./types";

type PlayerMeta = {
  id: string;
  name: string;
  position: Player["position"];
  teamId: Player["teamId"];
};

export type LastMoveInfo = {
  action: Extract<GameAction, { type: "playCard" }>;
  legalMoves: Card[];
} | null;

export type BotDifficulty = "easy" | "medium" | "hard";

export type BotSettings = {
  enabled: boolean;
  difficulty: BotDifficulty;
  model: string;
  temperature: number;
  usageHint: string;
};

const PLAYER_META: PlayerMeta[] = [
  { id: "player1", name: "You", position: "bottom", teamId: "teamA" },
  { id: "player2", name: "West", position: "left", teamId: "teamB" },
  { id: "player3", name: "North", position: "top", teamId: "teamA" },
  { id: "player4", name: "East", position: "right", teamId: "teamB" },
];

const HUMAN_PLAYER = 0;
const BOT_THINK_TIME_MS = 450;

const BOT_PRESETS: Record<BotDifficulty, Omit<BotSettings, "enabled">> = {
  easy: {
    difficulty: "easy",
    model: "openai/gpt-4o-mini",
    temperature: 0.2,
    usageHint: "Uses LLM only when 2 or fewer legal moves.",
  },
  medium: {
    difficulty: "medium",
    model: "openai/gpt-4o-mini",
    temperature: 0.5,
    usageHint: "Uses LLM when 4 or fewer legal moves.",
  },
  hard: {
    difficulty: "hard",
    model: "openai/gpt-4o",
    temperature: 0.7,
    usageHint: "Uses LLM on every bot move.",
  },
};

const cardId = (card: Card) => `${card.suit}-${card.rank}`;

const toPlayingCard = (card: Card): PlayingCard => ({
  suit: card.suit,
  rank: card.rank,
  id: cardId(card),
});

const normalizeSuit = (value: string): Suit | null => {
  const lowered = value.trim().toLowerCase();
  if (["clubs", "club", "c"].includes(lowered)) {
    return "clubs";
  }
  if (["diamonds", "diamond", "d"].includes(lowered)) {
    return "diamonds";
  }
  if (["hearts", "heart", "h"].includes(lowered)) {
    return "hearts";
  }
  if (["spades", "spade", "s"].includes(lowered)) {
    return "spades";
  }
  return null;
};

const normalizeRank = (value: string): Card["rank"] | null => {
  const upper = value.trim().toUpperCase();
  const allowed: Card["rank"][] = ["7", "8", "9", "10", "J", "Q", "K", "A"];
  return allowed.includes(upper as Card["rank"]) ? (upper as Card["rank"]) : null;
};

const extractJson = (text: string): Record<string, unknown> | null => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const parseCardFromText = (text: string, legalMoves: Card[]): Card | null => {
  const json = extractJson(text);
  if (json) {
    const rank = typeof json.rank === "string" ? normalizeRank(json.rank) : null;
    const suit = typeof json.suit === "string" ? normalizeSuit(json.suit) : null;
    if (rank && suit) {
      const match = legalMoves.find((card) => card.rank === rank && card.suit === suit);
      if (match) {
        return match;
      }
    }
  }

  const regex = /(10|[7-9]|J|Q|K|A)\s*(clubs|diamonds|hearts|spades|[CDHS])/i;
  const match = text.match(regex);
  if (!match) {
    return null;
  }
  const rank = normalizeRank(match[1]);
  const suit = normalizeSuit(match[2]);
  if (!rank || !suit) {
    return null;
  }
  return legalMoves.find((card) => card.rank === rank && card.suit === suit) ?? null;
};

const shouldUseLLM = (legalMovesCount: number, difficulty: BotDifficulty) => {
  if (difficulty === "hard") {
    return true;
  }
  if (difficulty === "easy") {
    return legalMovesCount <= 2;
  }
  return legalMovesCount <= 4;
};

const requestLLMMove = async (state: EngineState, legalMoves: Card[], settings: BotSettings): Promise<Card | null> => {
  const player = state.currentPlayer;
  const hand = state.hands[player] ?? [];
  const lead = leadSuit(state.trick) ?? "none";
  const prompt = `You are an expert 29 card game bot.\nReturn a single JSON object with keys "rank" and "suit" for your chosen card.\nOnly choose from the provided legal moves.\n\nTrump: ${
    state.trumpRevealed ? state.trumpSuit : "hidden"
  }\nLead suit: ${lead}\nYour hand: ${hand.map(cardId).join(", ")}\nLegal moves: ${legalMoves
    .map((card) => `{"rank":"${card.rank}","suit":"${card.suit}"}`)
    .join(", ")}\n\nRespond with JSON only.`;

  try {
    const response = await fetch("/api/openrouter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.model,
        temperature: settings.temperature,
        messages: [
          {
            role: "system",
            content: "You choose legal cards for a 29 card game. Respond with JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json().catch(() => null)) as { message?: { content?: string } } | null;
    const content = data?.message?.content;
    if (!content) {
      return null;
    }
    return parseCardFromText(content, legalMoves);
  } catch {
    return null;
  }
};

const createUiState = (state: EngineState, roundNumber: number): GameState => {
  const players: Player[] = PLAYER_META.map((meta, index) => ({
    ...meta,
    cards: state.hands[index].map(toPlayingCard),
    isCurrentPlayer: state.currentPlayer === index,
  }));

  const teamA: Team = {
    id: "teamA",
    name: "You & North",
    players: [PLAYER_META[0].id, PLAYER_META[2].id],
    tricksWon: state.tricksWon[0],
    bid: state.bidTarget,
    bidWinner: state.bidderTeam === 0 ? PLAYER_META[0].id : PLAYER_META[1].id,
    gameScore: 0,
    handPoints: state.points[0],
  };

  const teamB: Team = {
    id: "teamB",
    name: "West & East",
    players: [PLAYER_META[1].id, PLAYER_META[3].id],
    tricksWon: state.tricksWon[1],
    gameScore: 0,
    handPoints: state.points[1],
  };

  const currentTrick = state.trick.plays.map((play) => ({
    playerId: PLAYER_META[play.player].id,
    card: toPlayingCard(play.card),
  }));

  return {
    players,
    teams: { teamA, teamB },
    trumpSuit: state.trumpSuit,
    trumpRevealed: state.trumpRevealed,
    currentTrick,
    phase: state.phase === "playing" ? "playing" : "finished",
    currentBid: state.bidTarget,
    bidWinner: state.bidderTeam === 0 ? PLAYER_META[0].id : PLAYER_META[1].id,
    roundNumber,
    trickNumber: state.trickNumber,
    currentPlayerId: PLAYER_META[state.currentPlayer].id,
    log: state.log,
  };
};

export const useGameController = () => {
  const [roundNumber, setRoundNumber] = useState(1);
  const [engineState, setEngineState] = useState<EngineState>(() => createGameState({ seed: Date.now() }));
  const [lastMove, setLastMove] = useState<LastMoveInfo>(null);
  const [botEnabled, setBotEnabled] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("easy");

  const botTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(engineState);

  useEffect(() => {
    stateRef.current = engineState;
  }, [engineState]);

  const preset = BOT_PRESETS[botDifficulty];
  const botSettings = useMemo<BotSettings>(
    () => ({
      ...preset,
      enabled: botEnabled,
    }),
    [botEnabled, preset]
  );

  const dispatch = useCallback((action: GameAction) => {
    setEngineState((prev) => {
      if (action.type === "playCard") {
        const hand = prev.hands[action.player] ?? [];
        setLastMove({ action, legalMoves: getLegalPlays(hand, prev.trick) });
      }
      return reduceGame(prev, action);
    });
  }, []);

  const legalCards = useMemo(() => {
    const hand = engineState.hands[HUMAN_PLAYER];
    return getLegalPlays(hand, engineState.trick).map(cardId);
  }, [engineState]);

  const handlePlayCard = useCallback(
    (card: PlayingCard) => {
      if (engineState.phase !== "playing") return;
      if (engineState.currentPlayer !== HUMAN_PLAYER) return;
      if (!legalCards.includes(card.id)) return;

      dispatch({
        type: "playCard",
        player: HUMAN_PLAYER,
        card: { suit: card.suit, rank: card.rank },
      });
    },
    [dispatch, engineState, legalCards]
  );

  const handleNewGame = useCallback(() => {
    setEngineState(createGameState({ seed: Date.now() }));
    setRoundNumber((prev) => prev + 1);
    setLastMove(null);
  }, []);

  useEffect(() => {
    if (engineState.phase !== "playing") return;
    if (engineState.currentPlayer === HUMAN_PLAYER) return;

    if (botTimeout.current) {
      clearTimeout(botTimeout.current);
    }

    const botPlayer = engineState.currentPlayer;
    const turnId = engineState.log.length;

    botTimeout.current = setTimeout(() => {
      const takeTurn = async () => {
        const snapshot = stateRef.current;
        if (snapshot.currentPlayer !== botPlayer) {
          return;
        }

        const hand = snapshot.hands[botPlayer] ?? [];
        const moves = getLegalPlays(hand, snapshot.trick);
        let chosen = chooseBotCard({ hand, trick: snapshot.trick });

        if (botSettings.enabled && shouldUseLLM(moves.length, botSettings.difficulty)) {
          const llmCard = await requestLLMMove(snapshot, moves, botSettings);
          if (llmCard) {
            chosen = llmCard;
          }
        }

        const latest = stateRef.current;
        if (latest.currentPlayer !== botPlayer || latest.log.length !== turnId) {
          return;
        }
        dispatch({ type: "playCard", player: botPlayer, card: chosen });
      };

      void takeTurn();
    }, BOT_THINK_TIME_MS);

    return () => {
      if (botTimeout.current) {
        clearTimeout(botTimeout.current);
      }
      botTimeout.current = null;
    };
  }, [botSettings, dispatch, engineState]);

  const gameState = useMemo(() => createUiState(engineState, roundNumber), [engineState, roundNumber]);

  return {
    gameState,
    engineState,
    legalCardIds: legalCards,
    onPlayCard: handlePlayCard,
    onNewGame: handleNewGame,
    lastMove,
    botSettings,
    setBotEnabled,
    setBotDifficulty,
  };
};

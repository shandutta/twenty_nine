import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cardPoints,
  chooseBotCard,
  createGameState,
  getLegalPlays,
  leadSuit,
  reduceGame,
  shouldRevealTrump,
  teamForPlayer,
} from "@twentynine/engine";
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
    model: "google/gemini-3-pro-preview",
    temperature: 0.2,
    usageHint: "Uses LLM on every bot move (conservative style).",
  },
  medium: {
    difficulty: "medium",
    model: "google/gemini-3-pro-preview",
    temperature: 0.3,
    usageHint: "Uses LLM on every bot move (balanced style).",
  },
  hard: {
    difficulty: "hard",
    model: "anthropic/claude-opus-4.5",
    temperature: 0.4,
    usageHint: "Uses LLM on every bot move (maximizes expected points).",
  },
};

const cardId = (card: Card) => `${card.suit}-${card.rank}`;
const cardLabel = (card: Card) => `${card.rank} of ${card.suit}`;

const TEAM_LABELS = ["Team A (You & North)", "Team B (West & East)"] as const;

const STRATEGY_GUIDE: Record<BotDifficulty, string> = {
  easy: [
    "Play safe and conservative.",
    "Prefer low-risk, low-point cards when multiple legal options exist.",
    "Avoid shedding high-value points early unless it clearly wins the trick.",
  ].join(" "),
  medium: [
    "Play balanced: contest valuable tricks but avoid unnecessary risk.",
    "Preserve high-point cards early unless winning a trick or setting up trump control.",
  ].join(" "),
  hard: [
    "Play optimally: maximize expected points and contract success.",
    "Use trump control and point timing; avoid wasting high-value cards without payoff.",
  ].join(" "),
};

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

const shouldUseLLM = () => true;

const requestLLMMove = async (state: EngineState, legalMoves: Card[], settings: BotSettings): Promise<Card | null> => {
  const player = state.currentPlayer;
  const hand = state.hands[player] ?? [];
  const lead = leadSuit(state.trick) ?? "none";
  const playerMeta = PLAYER_META[player];
  const myTeam = teamForPlayer(player);
  const bidderTeam = state.bidderTeam;
  const trickIndex = state.trickNumber + 1;
  const currentTrick = state.trick.plays.length
    ? state.trick.plays
        .map((play) => `${PLAYER_META[play.player].name}:${cardLabel(play.card)}`)
        .join(", ")
    : "none";
  const strategy = STRATEGY_GUIDE[settings.difficulty];
  const legalMovesWithPoints = legalMoves
    .map((card) => `{"rank":"${card.rank}","suit":"${card.suit}","points":${cardPoints(card)}}`)
    .join(", ");

  const prompt = [
    "You are an expert 29 card game bot. Return JSON only with keys \"rank\" and \"suit\".",
    "Always choose from the provided legal moves.",
    "",
    "Strategy guardrails:",
    "- Preserve high-value cards (J=3, 9=2, A=1, 10=1) early unless winning a trick or forced to slough.",
    "- Avoid dumping the 9 or J early when a lower legal card exists and the trick is not guaranteed.",
    "- If it is early (tricks 1-3) and a 0-point legal card exists, do not play a point card unless it clearly wins the trick.",
    "- If you are unlikely to win the current trick, favor the lowest-point legal card.",
    "- Prefer winning with the lowest necessary card; avoid overtrumping.",
    strategy,
    "",
    `Player: ${playerMeta.name} (${playerMeta.position}).`,
    `Your team: ${TEAM_LABELS[myTeam]}. Bidder: ${TEAM_LABELS[bidderTeam]} (target ${state.bidTarget}).`,
    `Trick ${trickIndex} of 8. Lead suit: ${lead}. Trump: ${state.trumpRevealed ? state.trumpSuit : "hidden"}.`,
    `Early trick: ${state.trickNumber < 3 ? "yes" : "no"}.`,
    `Score: Team A ${state.points[0]} pts, Team B ${state.points[1]} pts.`,
    `Current trick plays: ${currentTrick}.`,
    `Your hand: ${hand.map(cardLabel).join(", ")}.`,
    `Legal moves: ${legalMovesWithPoints}.`,
    "",
    "Respond with JSON only.",
  ].join("\n");

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

  const lastTrick = state.lastTrick
    ? {
        trickNumber: state.lastTrick.number,
        winnerPlayerId: PLAYER_META[state.lastTrick.winner].id,
        winnerTeamId: state.lastTrick.team === 0 ? "teamA" : "teamB",
        winningCard: toPlayingCard(state.lastTrick.card),
        points: state.lastTrick.points,
      }
    : null;

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
    lastTrick,
  };
};

export const useGameController = () => {
  const [roundNumber, setRoundNumber] = useState(1);
  const [engineState, setEngineState] = useState<EngineState>(() => createGameState({ seed: Date.now() }));
  const [lastMove, setLastMove] = useState<LastMoveInfo>(null);
  const [botEnabled, setBotEnabled] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("easy");
  const [llmInUse, setLlmInUse] = useState(false);

  const botTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(engineState);

  useEffect(() => {
    stateRef.current = engineState;
  }, [engineState]);

  useEffect(() => {
    if (!botSettings.enabled || engineState.currentPlayer === HUMAN_PLAYER) {
      setLlmInUse(false);
    }
  }, [botSettings.enabled, engineState.currentPlayer]);

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

  const canRevealTrump = useMemo(() => {
    if (engineState.phase !== "playing") return false;
    if (engineState.trumpRevealed) return false;
    if (engineState.currentPlayer !== HUMAN_PLAYER) return false;
    const hand = engineState.hands[HUMAN_PLAYER] ?? [];
    return shouldRevealTrump(hand, engineState.trick);
  }, [engineState]);

  const handleRevealTrump = useCallback(() => {
    if (!canRevealTrump) return;
    dispatch({ type: "revealTrump", player: HUMAN_PLAYER });
  }, [canRevealTrump, dispatch]);

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

        if (botSettings.enabled && shouldUseLLM()) {
          setLlmInUse(true);
          try {
            const llmCard = await requestLLMMove(snapshot, moves, botSettings);
            if (llmCard) {
              chosen = llmCard;
            }
          } finally {
            setLlmInUse(false);
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
    canRevealTrump,
    onRevealTrump: handleRevealTrump,
    lastMove,
    botSettings,
    llmInUse,
    setBotEnabled,
    setBotDifficulty,
  };
};

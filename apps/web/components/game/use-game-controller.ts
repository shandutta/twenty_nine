import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SUITS,
  cardPoints,
  canDeclareRoyals,
  chooseBotCard,
  createGameState,
  getLegalPlays,
  leadSuit,
  reduceGame,
  shouldRevealTrump,
  teamForPlayer,
} from "@twentynine/engine";
import type { Card, GameAction, GameState as EngineState, Suit } from "@twentynine/engine";
import type { ControlMode, GameState, LastTrickSummary, PlayingCard, Player, Team } from "./types";

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

export type ReasoningEffort = "xhigh" | "high" | "medium" | "low" | "minimal" | "none";

export type BotSettings = {
  enabled: boolean;
  difficulty: BotDifficulty;
  model: string;
  fallbackModels: string[];
  temperature: number;
  usageHint: string;
  reasoningEffort: ReasoningEffort;
  showReasoningTrace: boolean;
};

const PLAYER_META: PlayerMeta[] = [
  { id: "player1", name: "You", position: "bottom", teamId: "teamA" },
  { id: "player2", name: "West", position: "left", teamId: "teamB" },
  { id: "player3", name: "North", position: "top", teamId: "teamA" },
  { id: "player4", name: "East", position: "right", teamId: "teamB" },
];

const PRIMARY_HUMAN = 0;
const PARTNER_HUMAN = 2;
const BOT_THINK_TIME_MS = 450;

export const LLM_MODEL_OPTIONS = [
  { value: "openai/gpt-5.2-pro", label: "GPT-5.2 Pro" },
  { value: "anthropic/claude-opus-4.5", label: "Claude Opus 4.5" },
  { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro (Preview)" },
] as const;

export const REASONING_EFFORT_OPTIONS: Array<{ value: ReasoningEffort; label: string; note: string }> = [
  { value: "xhigh", label: "X-High", note: "Maximum depth" },
  { value: "high", label: "High", note: "Deeper thinking" },
  { value: "medium", label: "Medium", note: "Balanced" },
  { value: "low", label: "Low", note: "Faster" },
  { value: "minimal", label: "Minimal", note: "Very light" },
  { value: "none", label: "None", note: "Disable reasoning" },
];

const LLM_MODEL_POOL = LLM_MODEL_OPTIONS.map((option) => option.value);

const DEFAULT_LLM_MODEL = LLM_MODEL_OPTIONS[0].value;

const BOT_PRESETS: Record<BotDifficulty, Pick<BotSettings, "difficulty" | "temperature" | "usageHint">> = {
  easy: {
    difficulty: "easy",
    temperature: 0.2,
    usageHint: "Conservative: protects high-value points and plays safely.",
  },
  medium: {
    difficulty: "medium",
    temperature: 0.3,
    usageHint: "Balanced: contests key tricks without overcommitting.",
  },
  hard: {
    difficulty: "hard",
    temperature: 0.4,
    usageHint: "Aggressive: maximizes expected points and contract success.",
  },
};

const cardId = (card: Card) => `${card.suit}-${card.rank}`;
const cardLabel = (card: Card) => `${card.rank} of ${card.suit}`;

const TEAM_LABELS = ["Team A (You & North)", "Team B (West & East)"] as const;

const HUMAN_PLAYERS: Record<ControlMode, number[]> = {
  standard: [PRIMARY_HUMAN],
  "single-hand": [PRIMARY_HUMAN, PARTNER_HUMAN],
};

const estimateHandStrength = (hand: Card[]): number => {
  const basePoints = hand.reduce((sum, card) => sum + cardPoints(card), 0);
  const highCards = hand.filter((card) => card.rank === "J" || card.rank === "9").length;
  return basePoints + highCards * 0.6;
};

const chooseBotBidAmount = (hand: Card[], currentBid: number | null, config: EngineState["config"]): number | null => {
  const strength = estimateHandStrength(hand);
  const minBid = config.minBid;
  const maxBid = config.maxBidTarget;
  const minRaise = currentBid !== null ? currentBid + 1 : minBid;
  const desired = Math.min(maxBid, Math.max(minBid, Math.round(strength)));

  if (desired < minRaise) {
    return null;
  }

  return Math.min(desired, maxBid);
};

const chooseBotTrumpSuit = (hand: Card[]): Suit => {
  let bestSuit: Suit = SUITS[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const suit of SUITS) {
    const suited = hand.filter((card) => card.suit === suit);
    const suitPoints = suited.reduce((sum, card) => sum + cardPoints(card), 0);
    const jackNineBonus = suited.reduce((sum, card) => {
      if (card.rank === "J") return sum + 1.2;
      if (card.rank === "9") return sum + 0.9;
      return sum;
    }, 0);
    const lengthBonus = suited.length * 0.25;
    const score = suitPoints + jackNineBonus + lengthBonus;
    if (score > bestScore) {
      bestScore = score;
      bestSuit = suit;
    }
  }
  return bestSuit;
};

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

const extractReasoningTrace = (
  message: { reasoning?: unknown; reasoning_details?: unknown } | null
): { text: string | null; hasTrace: boolean } => {
  if (!message) return { text: null, hasTrace: false };
  if (typeof message.reasoning === "string" && message.reasoning.trim()) {
    return { text: message.reasoning.trim(), hasTrace: true };
  }
  if (!Array.isArray(message.reasoning_details)) {
    return { text: null, hasTrace: Boolean(message.reasoning_details) };
  }

  const parts: string[] = [];
  for (const detail of message.reasoning_details) {
    if (!detail || typeof detail !== "object") continue;
    const entry = detail as { type?: string; summary?: string; text?: string };
    if (entry.type === "reasoning.summary" && entry.summary) {
      parts.push(`Summary: ${entry.summary}`);
      continue;
    }
    if (entry.type === "reasoning.text" && entry.text) {
      parts.push(entry.text);
      continue;
    }
    if (entry.type === "reasoning.encrypted") {
      parts.push("[Encrypted reasoning]");
      continue;
    }
    if (entry.summary) {
      parts.push(`Summary: ${entry.summary}`);
      continue;
    }
    if (entry.text) {
      parts.push(entry.text);
    }
  }

  if (parts.length === 0) {
    return { text: null, hasTrace: true };
  }
  return { text: parts.join("\n\n"), hasTrace: true };
};

const shouldUseLLM = () => true;

type LlmDecision = {
  card: Card | null;
  reasoning: string | null;
  model: string | null;
  hasTrace: boolean;
};

const requestLLMMove = async (state: EngineState, legalMoves: Card[], settings: BotSettings): Promise<LlmDecision> => {
  const player = state.currentPlayer;
  const hand = state.hands[player] ?? [];
  const lead = leadSuit(state.trick) ?? "none";
  const playerMeta = PLAYER_META[player];
  const myTeam = teamForPlayer(player);
  const bidderTeam = state.bidderTeam;
  const bidderLabel = bidderTeam === null ? "TBD" : TEAM_LABELS[bidderTeam];
  const bidTarget = state.bidTarget ?? "--";
  const trickIndex = state.trickNumber + 1;
  const currentTrick = state.trick.plays.length
    ? state.trick.plays.map((play) => `${PLAYER_META[play.player].name}:${cardLabel(play.card)}`).join(", ")
    : "none";
  const strategy = STRATEGY_GUIDE[settings.difficulty];
  const legalMovesWithPoints = legalMoves
    .map((card) => `{"rank":"${card.rank}","suit":"${card.suit}","points":${cardPoints(card)}}`)
    .join(", ");

  const trumpLabel = state.trumpSuit ?? "joker (no trump)";
  const prompt = [
    'You are an expert 29 card game bot. Return JSON only with keys "rank" and "suit".',
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
    `Your team: ${TEAM_LABELS[myTeam]}. Bidder: ${bidderLabel} (target ${bidTarget}).`,
    `Trick ${trickIndex} of 8. Lead suit: ${lead}. Trump: ${state.trumpRevealed ? trumpLabel : "hidden"}.`,
    `Early trick: ${state.trickNumber < 3 ? "yes" : "no"}.`,
    `Score: Team A ${state.points[0]} pts, Team B ${state.points[1]} pts.`,
    `Current trick plays: ${currentTrick}.`,
    `Your hand: ${hand.map(cardLabel).join(", ")}.`,
    `Legal moves: ${legalMovesWithPoints}.`,
    "",
    "Respond with JSON only.",
  ].join("\n");

  const modelQueue = Array.from(new Set([settings.model, ...settings.fallbackModels].filter(Boolean)));

  for (const model of modelQueue) {
    try {
      const response = await fetch("/api/openrouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: settings.temperature,
          reasoning: {
            effort: settings.reasoningEffort,
            exclude: !settings.showReasoningTrace,
          },
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
        continue;
      }

      const data = (await response.json().catch(() => null)) as {
        message?: { content?: string; reasoning?: unknown; reasoning_details?: unknown };
      } | null;
      const message = data?.message ?? null;
      const content = message?.content;
      if (!content) {
        continue;
      }
      const parsed = parseCardFromText(content, legalMoves);
      if (parsed) {
        const reasoning = extractReasoningTrace(message);
        return {
          card: parsed,
          reasoning: reasoning.text,
          model,
          hasTrace: reasoning.hasTrace,
        };
      }
    } catch {
      continue;
    }
  }

  return { card: null, reasoning: null, model: null, hasTrace: false };
};

const createUiState = (state: EngineState, controlMode: ControlMode): GameState => {
  const resolvedMeta = PLAYER_META.map((meta, index) => {
    if (controlMode === "single-hand" && index === PARTNER_HUMAN) {
      return { ...meta, name: "Partner" };
    }
    return meta;
  });

  const players: Player[] = resolvedMeta.map((meta, index) => ({
    ...meta,
    cards: state.hands[index].map(toPlayingCard),
    isCurrentPlayer: state.currentPlayer === index,
  }));

  const bidderPlayerId = state.bidderPlayer !== null ? resolvedMeta[state.bidderPlayer].id : null;
  const bidderTeamId = state.bidderPlayer !== null ? (state.bidderPlayer % 2 === 0 ? "teamA" : "teamB") : null;

  const teamA: Team = {
    id: "teamA",
    name: controlMode === "single-hand" ? "You & Partner" : "You & North",
    players: [resolvedMeta[0].id, resolvedMeta[2].id],
    tricksWon: state.tricksWon[0],
    bid: bidderTeamId === "teamA" ? (state.bidTarget ?? undefined) : undefined,
    bidWinner: bidderTeamId === "teamA" ? (bidderPlayerId ?? undefined) : undefined,
    gameScore: 0,
    handPoints: state.points[0],
  };

  const teamB: Team = {
    id: "teamB",
    name: "West & East",
    players: [resolvedMeta[1].id, resolvedMeta[3].id],
    tricksWon: state.tricksWon[1],
    bid: bidderTeamId === "teamB" ? (state.bidTarget ?? undefined) : undefined,
    bidWinner: bidderTeamId === "teamB" ? (bidderPlayerId ?? undefined) : undefined,
    gameScore: 0,
    handPoints: state.points[1],
  };

  const currentTrick = state.trick.plays.map((play) => ({
    playerId: resolvedMeta[play.player].id,
    card: toPlayingCard(play.card),
  }));

  const lastTrick: LastTrickSummary | null = state.lastTrick
    ? {
        trickNumber: state.lastTrick.number,
        winnerPlayerId: resolvedMeta[state.lastTrick.winner].id,
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
    phase: state.phase === "hand-complete" ? "finished" : state.phase,
    currentBid: state.bidTarget,
    bidWinner: bidderPlayerId,
    royalsDeclaredBy: state.royalsDeclaredBy === null ? null : state.royalsDeclaredBy === 0 ? "teamA" : "teamB",
    royalsAdjustment: state.config.royalsAdjustment,
    royalsMinTarget: state.config.minBid,
    royalsMaxTarget: state.config.maxBidTarget,
    roundNumber: state.matchRound,
    matchRound: state.matchRound,
    matchRedPips: state.matchRedPips,
    matchBlackPips: state.matchBlackPips,
    matchWinner: state.matchWinner === null ? null : state.matchWinner === 0 ? "teamA" : "teamB",
    matchEndReason: state.matchEndReason,
    trickNumber: state.trickNumber,
    currentPlayerId: resolvedMeta[state.currentPlayer].id,
    log: state.log,
    lastTrick,
  };
};

export const useGameController = () => {
  const [engineState, setEngineState] = useState<EngineState>(() => createGameState({ seed: Date.now() }));
  const [lastMove, setLastMove] = useState<LastMoveInfo>(null);
  const [botEnabled, setBotEnabled] = useState(true);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("easy");
  const [botModel, setBotModel] = useState<string>(DEFAULT_LLM_MODEL);
  const [botTemperature, setBotTemperature] = useState<number>(BOT_PRESETS.easy.temperature);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("high");
  const [showReasoningTrace, setShowReasoningTrace] = useState(false);
  const [llmReasoning, setLlmReasoning] = useState<string | null>(null);
  const [llmReasoningMeta, setLlmReasoningMeta] = useState<{
    model: string;
    effort: ReasoningEffort;
    ts: number;
    hasTrace: boolean;
  } | null>(null);
  const [llmInUse, setLlmInUse] = useState(false);
  const [controlMode, setControlMode] = useState<ControlMode>("standard");
  const [controlModeLocked, setControlModeLocked] = useState(false);

  const botTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(engineState);

  const humanPlayers = useMemo(() => HUMAN_PLAYERS[controlMode], [controlMode]);
  const isHumanTurn = humanPlayers.includes(engineState.currentPlayer);

  const preset = BOT_PRESETS[botDifficulty];
  const fallbackModels = useMemo(() => LLM_MODEL_POOL.filter((model) => model !== botModel), [botModel]);
  const botSettings = useMemo<BotSettings>(
    () => ({
      ...preset,
      enabled: botEnabled,
      model: botModel,
      fallbackModels,
      temperature: botTemperature,
      reasoningEffort,
      showReasoningTrace,
    }),
    [botEnabled, preset, botModel, fallbackModels, botTemperature, reasoningEffort, showReasoningTrace]
  );

  useEffect(() => {
    setBotTemperature(BOT_PRESETS[botDifficulty].temperature);
  }, [botDifficulty]);

  useEffect(() => {
    stateRef.current = engineState;
  }, [engineState]);

  useEffect(() => {
    if (engineState.phase === "playing" || engineState.phase === "hand-complete") {
      setControlModeLocked(true);
    }
  }, [engineState.phase]);

  useEffect(() => {
    if (!botSettings.enabled || isHumanTurn) {
      setLlmInUse(false);
    }
  }, [botSettings.enabled, engineState.currentPlayer, isHumanTurn]);

  const dispatch = useCallback((action: GameAction) => {
    setEngineState((prev) => {
      if (action.type === "playCard") {
        const hand = prev.hands[action.player] ?? [];
        setLastMove({
          action,
          legalMoves: getLegalPlays(hand, prev.trick, {
            trumpSuit: prev.trumpSuit,
            trumpRevealed: prev.trumpRevealed,
            trumpFromSeventh: prev.trumpFromSeventh,
          }),
        });
      }
      return reduceGame(prev, action);
    });
  }, []);

  const legalCards = useMemo(() => {
    if (engineState.phase !== "playing") {
      return [];
    }
    if (!isHumanTurn) return [];
    const hand = engineState.hands[engineState.currentPlayer] ?? [];
    return getLegalPlays(hand, engineState.trick, {
      trumpSuit: engineState.trumpSuit,
      trumpRevealed: engineState.trumpRevealed,
      trumpFromSeventh: engineState.trumpFromSeventh,
    }).map(cardId);
  }, [engineState, isHumanTurn]);

  const handlePlayCard = useCallback(
    (card: PlayingCard) => {
      if (engineState.phase !== "playing") return;
      if (!isHumanTurn) return;
      if (!legalCards.includes(card.id)) return;

      dispatch({
        type: "playCard",
        player: engineState.currentPlayer,
        card: { suit: card.suit, rank: card.rank },
      });
    },
    [dispatch, engineState, isHumanTurn, legalCards]
  );

  const canBid = useMemo(() => engineState.phase === "bidding" && isHumanTurn, [engineState, isHumanTurn]);

  const bidOptions = useMemo(() => {
    if (!canBid) return [];
    const minBid = engineState.config.minBid;
    const maxBid = engineState.config.maxBidTarget;
    const current = engineState.bidTarget ?? minBid - 1;
    const start = Math.max(minBid, current + 1);
    if (start > maxBid) return [];
    return Array.from({ length: maxBid - start + 1 }, (_, i) => start + i);
  }, [canBid, engineState]);

  const handlePlaceBid = useCallback(
    (amount: number) => {
      if (!canBid) return;
      dispatch({ type: "placeBid", player: engineState.currentPlayer, amount });
    },
    [canBid, dispatch, engineState.currentPlayer]
  );

  const handlePassBid = useCallback(() => {
    if (!canBid) return;
    dispatch({ type: "passBid", player: engineState.currentPlayer });
  }, [canBid, dispatch, engineState.currentPlayer]);

  const canChooseTrump = useMemo(() => engineState.phase === "choose-trump" && isHumanTurn, [engineState, isHumanTurn]);

  const handleChooseTrump = useCallback(
    (suit: Suit | null) => {
      if (!canChooseTrump) return;
      dispatch({ type: "chooseTrump", player: engineState.currentPlayer, suit });
    },
    [canChooseTrump, dispatch, engineState.currentPlayer]
  );

  const handleChooseTrumpFromSeventh = useCallback(() => {
    if (!canChooseTrump) return;
    dispatch({ type: "chooseTrumpFromSeventh", player: engineState.currentPlayer });
  }, [canChooseTrump, dispatch, engineState.currentPlayer]);

  const handleNewGame = useCallback(() => {
    if (botTimeout.current) {
      clearTimeout(botTimeout.current);
      botTimeout.current = null;
    }
    setLlmInUse(false);
    setEngineState((prev) =>
      createGameState({
        seed: prev.seed + 1,
        dealer: (prev.dealer + 1) % 4,
        config: prev.config,
      })
    );
    setLastMove(null);
    setLlmReasoning(null);
    setLlmReasoningMeta(null);
    setControlModeLocked(false);
  }, []);
  const canStartNextHand = engineState.phase === "hand-complete" && engineState.matchWinner === null;
  const handleNextHand = useCallback(() => {
    if (!canStartNextHand) return;
    if (botTimeout.current) {
      clearTimeout(botTimeout.current);
      botTimeout.current = null;
    }
    setLlmInUse(false);
    setLastMove(null);
    setLlmReasoning(null);
    setLlmReasoningMeta(null);
    dispatch({ type: "startNextHand" });
  }, [canStartNextHand, dispatch]);

  const canRevealTrump = useMemo(() => {
    if (engineState.phase !== "playing") return false;
    if (engineState.trumpSuit === null) return false;
    if (engineState.trumpRevealed) return false;
    if (engineState.trumpFromSeventh) return false;
    if (!isHumanTurn) return false;
    const hand = engineState.hands[engineState.currentPlayer] ?? [];
    return shouldRevealTrump(hand, engineState.trick);
  }, [engineState, isHumanTurn]);

  const handleRevealTrump = useCallback(() => {
    if (!canRevealTrump) return;
    dispatch({ type: "revealTrump", player: engineState.currentPlayer });
  }, [canRevealTrump, dispatch, engineState.currentPlayer]);

  const canDeclareRoyalsForHuman = useMemo(() => {
    if (engineState.phase !== "playing") return false;
    if (engineState.trumpSuit === null) return false;
    if (engineState.royalsDeclaredBy !== null) return false;
    if (engineState.lastTrickWinnerTeam === null) return false;
    if (!isHumanTurn) return false;
    const hand = engineState.hands[engineState.currentPlayer] ?? [];
    const declarerTeam = teamForPlayer(engineState.currentPlayer);
    return canDeclareRoyals({
      hand,
      trumpSuit: engineState.trumpSuit,
      trumpRevealed: engineState.trumpRevealed,
      lastTrickWinnerTeam: engineState.lastTrickWinnerTeam,
      declarerTeam,
    });
  }, [engineState, isHumanTurn]);

  const handleDeclareRoyals = useCallback(() => {
    if (!canDeclareRoyalsForHuman) return;
    dispatch({ type: "declareRoyals", player: engineState.currentPlayer });
  }, [canDeclareRoyalsForHuman, dispatch, engineState.currentPlayer]);

  useEffect(() => {
    if (engineState.phase !== "playing") {
      setLlmInUse(false);
    }
    if (engineState.phase === "hand-complete") return;
    if (isHumanTurn) return;

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

        if (snapshot.phase === "bidding") {
          const hand = snapshot.hands[botPlayer] ?? [];
          const bid = chooseBotBidAmount(hand, snapshot.bidTarget, snapshot.config);
          const latest = stateRef.current;
          if (latest.currentPlayer !== botPlayer || latest.log.length !== turnId) {
            return;
          }
          if (bid === null) {
            dispatch({ type: "passBid", player: botPlayer });
          } else {
            dispatch({ type: "placeBid", player: botPlayer, amount: bid });
          }
          return;
        }

        if (snapshot.phase === "choose-trump") {
          const hand = snapshot.hands[botPlayer] ?? [];
          const suit = chooseBotTrumpSuit(hand);
          const latest = stateRef.current;
          if (latest.currentPlayer !== botPlayer || latest.log.length !== turnId) {
            return;
          }
          dispatch({ type: "chooseTrump", player: botPlayer, suit });
          return;
        }

        if (snapshot.phase !== "playing") {
          return;
        }

        const hand = snapshot.hands[botPlayer] ?? [];
        const moves = getLegalPlays(hand, snapshot.trick, {
          trumpSuit: snapshot.trumpSuit,
          trumpRevealed: snapshot.trumpRevealed,
          trumpFromSeventh: snapshot.trumpFromSeventh,
        });
        let chosen = chooseBotCard({
          hand,
          trick: snapshot.trick,
          trumpSuit: snapshot.trumpSuit,
          trumpRevealed: snapshot.trumpRevealed,
          trumpFromSeventh: snapshot.trumpFromSeventh,
        });

        if (botSettings.enabled && shouldUseLLM()) {
          setLlmInUse(true);
          try {
            const llmDecision = await requestLLMMove(snapshot, moves, botSettings);
            if (llmDecision.card) {
              chosen = llmDecision.card;
            }
            if (llmDecision.model) {
              setLlmReasoning(llmDecision.reasoning);
              setLlmReasoningMeta({
                model: llmDecision.model,
                effort: botSettings.reasoningEffort,
                ts: Date.now(),
                hasTrace: llmDecision.hasTrace,
              });
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
  }, [botSettings, dispatch, engineState, isHumanTurn]);

  const handleControlModeChange = useCallback(
    (mode: ControlMode) => {
      if (controlModeLocked) return;
      if (mode === controlMode) return;
      setControlMode(mode);
      setControlModeLocked(true);
      if (botTimeout.current) {
        clearTimeout(botTimeout.current);
        botTimeout.current = null;
      }
      setLlmInUse(false);
      setEngineState((prev) =>
        createGameState({
          seed: prev.seed + 1,
          dealer: (prev.dealer + 1) % 4,
          config: prev.config,
        })
      );
      setLastMove(null);
      setLlmReasoning(null);
      setLlmReasoningMeta(null);
    },
    [controlMode, controlModeLocked]
  );

  const gameState = useMemo(() => createUiState(engineState, controlMode), [engineState, controlMode]);

  return {
    gameState,
    engineState,
    legalCardIds: legalCards,
    onPlayCard: handlePlayCard,
    bidOptions,
    canBid,
    onPlaceBid: handlePlaceBid,
    onPassBid: handlePassBid,
    canChooseTrump,
    onChooseTrump: handleChooseTrump,
    onChooseTrumpFromSeventh: handleChooseTrumpFromSeventh,
    onNewGame: handleNewGame,
    onNextHand: handleNextHand,
    canStartNextHand,
    canRevealTrump,
    onRevealTrump: handleRevealTrump,
    canDeclareRoyals: canDeclareRoyalsForHuman,
    onDeclareRoyals: handleDeclareRoyals,
    lastMove,
    botSettings,
    llmInUse,
    llmReasoning,
    llmReasoningMeta,
    setBotEnabled,
    setBotDifficulty,
    setBotModel,
    setBotTemperature,
    setReasoningEffort,
    setShowReasoningTrace,
    controlMode,
    controlModeLocked,
    onControlModeChange: handleControlModeChange,
  };
};

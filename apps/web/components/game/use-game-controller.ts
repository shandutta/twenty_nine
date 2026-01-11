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
  winningPlay,
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
};

const STORAGE_KEY = "twentynine:game-state:v1";
const STORAGE_VERSION = 1;

type PersistedGameState = {
  version: typeof STORAGE_VERSION;
  engineState: EngineState;
  lastMove: LastMoveInfo;
  botEnabled: boolean;
  botDifficulty: BotDifficulty;
  botModel: string;
  botTemperature: number;
  reasoningEffort: ReasoningEffort;
  controlMode: ControlMode;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isPersistedState = (value: unknown): value is PersistedGameState => {
  if (!isRecord(value)) return false;
  if (value.version !== STORAGE_VERSION) return false;
  const engineState = value.engineState;
  if (!isRecord(engineState)) return false;
  if (!Array.isArray(engineState.hands)) return false;
  if (typeof engineState.currentPlayer !== "number") return false;
  if (typeof engineState.phase !== "string") return false;
  return true;
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
const TRICK_RESOLUTION_DELAY_MS = 500;

export const LLM_MODEL_OPTIONS = [
  { value: "openai/gpt-5.2-chat", label: "GPT-5.2 Chat" },
  { value: "openai/gpt-5.2", label: "GPT-5.2" },
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

const DEFAULT_REASONING_EFFORT_BY_DIFFICULTY: Record<BotDifficulty, ReasoningEffort> = {
  easy: "low",
  medium: "medium",
  hard: "high",
};

const cardId = (card: Card) => `${card.suit}-${card.rank}`;
const cardLabel = (card: Card) => `${card.rank} of ${card.suit}`;
const cardShortLabel = (card: Card) => `${card.rank}${card.suit[0]?.toUpperCase() ?? ""}`;

const RANK_ORDER: Card["rank"][] = ["J", "9", "A", "10", "K", "Q", "8", "7"];
const RANK_ORDER_LABEL = RANK_ORDER.join(" > ");
const TOTAL_HAND_POINTS = 29;
const PLAY_LOG_RE = /played\s+(J|9|A|10|K|Q|8|7)\s+of\s+(hearts|diamonds|clubs|spades)\./i;

const handShortLabels = (hand: Card[]) => hand.map(cardShortLabel);

const trickShortLabels = (trick: EngineState["trick"]) =>
  trick.plays.map((play) => ({
    player: play.player,
    card: cardShortLabel(play.card),
  }));

const lastTrickSummary = (lastTrick: EngineState["lastTrick"]) => {
  if (!lastTrick) return null;
  return {
    number: lastTrick.number,
    winner: lastTrick.winner,
    team: lastTrick.team,
    points: lastTrick.points,
    card: cardShortLabel(lastTrick.card),
    plays: lastTrick.plays.map((play) => ({
      player: play.player,
      card: cardShortLabel(play.card),
    })),
  };
};

const buildGameLogContext = (state: EngineState) => ({
  matchRound: state.matchRound,
  phase: state.phase,
  seed: state.seed,
  dealer: state.dealer,
  leader: state.leader,
  currentPlayer: state.currentPlayer,
  trickNumber: state.trickNumber,
  bidTarget: state.bidTarget,
  bidPasses: state.bidPasses,
  bidderPlayer: state.bidderPlayer,
  bidderTeam: state.bidderTeam,
  bidHistory: state.bidHistory,
  trumpSuit: state.trumpSuit,
  trumpRevealed: state.trumpRevealed,
  trumpFromSeventh: state.trumpFromSeventh,
  points: state.points,
  tricksWon: state.tricksWon,
  matchRedPips: state.matchRedPips,
  matchBlackPips: state.matchBlackPips,
  matchWinner: state.matchWinner,
  matchEndReason: state.matchEndReason,
  trickPlays: trickShortLabels(state.trick),
});

const round2 = (value: number) => Math.round(value * 100) / 100;

const TEAM_LABELS = ["Team A (North & South)", "Team B (West & East)"] as const;

const HUMAN_PLAYERS: Record<ControlMode, number[]> = {
  standard: [PRIMARY_HUMAN],
  "single-hand": [PRIMARY_HUMAN, PARTNER_HUMAN],
};

const parsePlayedCardsFromLog = (log: string[]): Card[] => {
  const seen: Card[] = [];
  for (const entry of log) {
    const match = entry.match(PLAY_LOG_RE);
    if (!match) continue;
    const rank = match[1]?.toUpperCase() as Card["rank"];
    const suit = match[2]?.toLowerCase() as Suit;
    if (!rank || !suit) continue;
    seen.push({ rank, suit });
  }
  return seen;
};

const collectSeenCards = (state: EngineState): Card[] => {
  const seen: Card[] = [];
  const seenIds = new Set<string>();
  const pushCard = (card: Card) => {
    const id = cardId(card);
    if (seenIds.has(id)) return;
    seenIds.add(id);
    seen.push(card);
  };

  for (const card of parsePlayedCardsFromLog(state.log)) {
    pushCard(card);
  }
  for (const play of state.trick.plays) {
    pushCard(play.card);
  }
  if (state.lastTrick) {
    for (const play of state.lastTrick.plays) {
      pushCard(play.card);
    }
  }
  return seen;
};

const sortRanks = (ranks: Card["rank"][]) =>
  ranks.slice().sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b));

const formatSeenCardsBySuit = (cards: Card[]): string => {
  const bySuit: Record<Suit, Card["rank"][]> = {
    hearts: [],
    diamonds: [],
    clubs: [],
    spades: [],
  };
  for (const card of cards) {
    const list = bySuit[card.suit];
    if (!list.includes(card.rank)) {
      list.push(card.rank);
    }
  }
  const parts = SUITS.map((suit) => {
    const ranks = sortRanks(bySuit[suit]);
    return ranks.length ? `${suit} [${ranks.join(", ")}]` : null;
  }).filter(Boolean) as string[];
  return parts.length ? parts.join("; ") : "none";
};

const formatSeenTrumpRanks = (cards: Card[], trumpSuit: Suit): string => {
  const ranks: Card["rank"][] = [];
  for (const card of cards) {
    if (card.suit !== trumpSuit) continue;
    if (!ranks.includes(card.rank)) {
      ranks.push(card.rank);
    }
  }
  const sorted = sortRanks(ranks);
  return sorted.length ? sorted.join(", ") : "none";
};

const formatOutstandingTrumpRanks = (cards: Card[], hand: Card[], trumpSuit: Suit): string => {
  const seenRanks = new Set(cards.filter((card) => card.suit === trumpSuit).map((card) => card.rank));
  const handRanks = new Set(hand.filter((card) => card.suit === trumpSuit).map((card) => card.rank));
  const remaining = RANK_ORDER.filter((rank) => !seenRanks.has(rank) && !handRanks.has(rank));
  return remaining.length ? remaining.join(", ") : "none";
};

const isTrumpKnownToPlayer = (state: EngineState, player: number): boolean => {
  if (state.trumpSuit === null) return true;
  if (state.trumpRevealed) return true;
  if (state.trumpFromSeventh) return false;
  return state.bidderPlayer === player;
};

const formatTrumpLine = (state: EngineState, player: number): string => {
  const trumpLabel = state.trumpSuit ?? "joker (no trump)";
  if (state.trumpSuit === null) return `Trump: ${trumpLabel}.`;
  if (state.trumpRevealed) return `Trump: ${trumpLabel}.`;
  if (!state.trumpFromSeventh && state.bidderPlayer === player) {
    return `Trump: ${trumpLabel} (known to you, not revealed).`;
  }
  return "Trump: hidden.";
};

const RANK_POWER_BID: Record<Card["rank"], number> = {
  J: 7,
  "9": 6,
  A: 5,
  "10": 4,
  K: 3,
  Q: 2,
  "8": 1,
  "7": 0,
};

const BID_THRESHOLD_BASE = [11.5, 13, 14.5, 16, 17.5, 19];
const BID_THRESHOLD_OFFSET: Record<BotDifficulty, number> = {
  easy: 1,
  medium: 0,
  hard: -1,
};
const BID_STRETCH: Record<BotDifficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 1,
};

type BidProjection = {
  bestSuit: Suit;
  trumpScore: number;
  sidePoints: number;
  strength: number;
  desiredBid: number | null;
  thresholds: number[];
  stretch: number;
};

const scoreTrumpSuit = (hand: Card[], suit: Suit): number => {
  const suited = hand.filter((card) => card.suit === suit);
  if (suited.length === 0) return Number.NEGATIVE_INFINITY;
  const count = suited.length;
  const points = suited.reduce((sum, card) => sum + cardPoints(card), 0);
  const power = suited.reduce((sum, card) => sum + RANK_POWER_BID[card.rank], 0);
  const has = (rank: Card["rank"]) => suited.some((card) => card.rank === rank);

  let score = points * 1.6 + power * 0.4 + count * 1.2;
  if (has("J")) score += 2.5;
  if (has("9")) score += 2.0;
  if (has("A")) score += 1.0;
  if (has("10")) score += 0.8;
  if (has("K")) score += 0.3;
  if (has("Q")) score += 0.2;
  if (has("J") && has("9")) score += 2.5;
  if (has("J") && (has("A") || has("10"))) score += 1.0;
  if (has("9") && (has("A") || has("10"))) score += 0.6;
  if (count >= 3) score += 1.5;
  if (count === 4) score += 2.5;

  return score;
};

const projectBidStrength = (hand: Card[], difficulty: BotDifficulty, config: EngineState["config"]): BidProjection => {
  let bestSuit: Suit = SUITS[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const suit of SUITS) {
    const score = scoreTrumpSuit(hand, suit);
    if (score > bestScore) {
      bestScore = score;
      bestSuit = suit;
    }
  }

  const sidePoints = hand.filter((card) => card.suit !== bestSuit).reduce((sum, card) => sum + cardPoints(card), 0);
  const strength = bestScore + sidePoints * 0.6;

  const offset = BID_THRESHOLD_OFFSET[difficulty];
  const thresholds = BID_THRESHOLD_BASE.map((value) => value + offset);
  const minBid = config.minBid;
  const maxBid = config.maxBidTarget;
  const ladderSize = Math.min(maxBid - minBid + 1, thresholds.length);
  const ladder = Array.from({ length: Math.max(0, ladderSize) }, (_, i) => minBid + i);
  const effectiveThresholds = thresholds.slice(0, ladder.length);

  let desiredBid: number | null = null;
  if (ladder.length > 0 && strength >= effectiveThresholds[0]) {
    desiredBid = ladder[ladder.length - 1];
    for (let i = 1; i < effectiveThresholds.length; i += 1) {
      if (strength < effectiveThresholds[i]) {
        desiredBid = ladder[i - 1];
        break;
      }
    }
  }

  return {
    bestSuit,
    trumpScore: bestScore,
    sidePoints,
    strength,
    desiredBid,
    thresholds: effectiveThresholds,
    stretch: BID_STRETCH[difficulty],
  };
};

const getLegalBidOptions = (state: EngineState): number[] => {
  const minBid = state.config.minBid;
  const maxBid = state.config.maxBidTarget;
  const current = state.bidTarget ?? minBid - 1;
  const start = Math.max(minBid, current + 1);
  if (start > maxBid) return [];
  return Array.from({ length: maxBid - start + 1 }, (_, i) => start + i);
};

const chooseBotBidAmount = (
  hand: Card[],
  currentBid: number | null,
  config: EngineState["config"],
  difficulty: BotDifficulty
): { bid: number | null; evaluation: BidProjection; minRaise: number } => {
  const evaluation = projectBidStrength(hand, difficulty, config);
  const minBid = config.minBid;
  const maxBid = config.maxBidTarget;
  const minRaise = currentBid !== null ? currentBid + 1 : minBid;

  if (minRaise > maxBid) {
    return { bid: null, evaluation, minRaise };
  }

  let bid = evaluation.desiredBid;
  if (bid === null) {
    return { bid: null, evaluation, minRaise };
  }

  if (bid < minRaise) {
    if (minRaise - bid <= evaluation.stretch) {
      bid = minRaise;
    } else {
      return { bid: null, evaluation, minRaise };
    }
  }

  bid = Math.min(maxBid, bid);
  if (bid < minBid) {
    return { bid: null, evaluation, minRaise };
  }

  return { bid, evaluation, minRaise };
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

const parseBidFromText = (text: string, legalBids: number[]): number | null | undefined => {
  const normalized = text.trim().toLowerCase();
  const extracted = extractJson(text);
  const parseAmount = (value: unknown): number | null => {
    if (value === null) return null;
    if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return Math.round(parsed);
    }
    return null;
  };

  if (extracted && typeof extracted === "object") {
    const record = extracted as Record<string, unknown>;
    const action = typeof record.action === "string" ? record.action.trim().toLowerCase() : null;
    if (action === "pass" || action === "fold" || action === "check") {
      return null;
    }
    if (record.pass === true) {
      return null;
    }
    const amount = parseAmount(record.amount ?? record.bid ?? record.raise);
    if (amount === null) {
      return action === "pass" ? null : undefined;
    }
    if (legalBids.includes(amount)) {
      return amount;
    }
    return undefined;
  }

  if (normalized.includes("pass")) {
    return null;
  }

  const numberMatch = normalized.match(/-?\d+/);
  if (numberMatch) {
    const amount = Number.parseInt(numberMatch[0] ?? "", 10);
    if (Number.isFinite(amount) && legalBids.includes(amount)) {
      return amount;
    }
  }

  return undefined;
};

const shouldUseLLM = () => true;

type LlmUsage = Record<string, unknown> | null;

type LlmMetrics = {
  durationMs: number | null;
  usage: LlmUsage;
  costUsd: number | null;
};

type LlmDecision = {
  card: Card | null;
  model: string | null;
  metrics: LlmMetrics | null;
};

type LlmBidDecision = {
  bid: number | null | undefined;
  model: string | null;
  metrics: LlmMetrics | null;
};

const requestLLMBid = async (state: EngineState, settings: BotSettings): Promise<LlmBidDecision> => {
  const player = state.currentPlayer;
  const hand = state.hands[player] ?? [];
  const playerMeta = PLAYER_META[player];
  const myTeam = teamForPlayer(player);
  const bidderTeam = state.bidderTeam;
  const bidderLabel = bidderTeam === null ? "TBD" : TEAM_LABELS[bidderTeam];
  const currentBid = state.bidTarget === null ? "none" : state.bidTarget;
  const legalBids = getLegalBidOptions(state);
  const bidHistory = state.bidHistory.length
    ? state.bidHistory
        .map((entry) => `${PLAYER_META[entry.player].name}:${entry.bid === null ? "pass" : entry.bid}`)
        .join(", ")
    : "none";
  const strategy = STRATEGY_GUIDE[settings.difficulty];
  const legalBidsLabel = legalBids.length ? legalBids.join(", ") : "none";

  const prompt = [
    'You are an expert 29 card game bidder. Return JSON only with either {"action":"pass"} or {"action":"bid","amount":17}.',
    "Always choose a bid amount from the provided legal raises.",
    "Passing is always allowed.",
    "",
    "Strategy guardrails:",
    "- Bidding is a gamble with only 4 cards; project likely trump suit strength and expected points after the final 4 cards.",
    "- Favor bidding when you have strong trump indicators (J/9, suit length, high ranks) plus some outside points.",
    "- If the current bid is already high for that projection, pass.",
    "- Prefer a minimal raise when your hand is borderline.",
    strategy,
    `Rules: Rank order ${RANK_ORDER_LABEL}. Last trick bonus: +1 (hand totals can sum to ${TOTAL_HAND_POINTS}).`,
    "",
    `Player: ${playerMeta.name} (${playerMeta.position}).`,
    `Your team: ${TEAM_LABELS[myTeam]}. Current bidder: ${bidderLabel}.`,
    `Current bid: ${currentBid}.`,
    `Bid history: ${bidHistory}.`,
    `Your hand: ${hand.map(cardLabel).join(", ")}.`,
    `Legal raises: ${legalBidsLabel}.`,
    legalBids.length === 0 ? "No legal raises available; you must pass." : "",
    "",
    "Respond with JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

  const modelQueue = Array.from(new Set([settings.model, ...settings.fallbackModels].filter(Boolean)));

  for (const model of modelQueue) {
    try {
      const response = await fetch("/api/openrouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: settings.temperature,
          trace: {
            source: "bot",
            matchRound: state.matchRound,
            trickNumber: state.trickNumber + 1,
            phase: state.phase,
            playerId: playerMeta.id,
            playerName: playerMeta.name,
            gameSeed: state.seed,
            turnId: state.log.length,
          },
          reasoning: {
            effort: settings.reasoningEffort,
          },
          messages: [
            {
              role: "system",
              content: "You choose whether to raise or pass in 29 bidding. Respond with JSON only.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        continue;
      }

      const data = (await response.json().catch(() => null)) as {
        message?: { content?: string };
        metrics?: { durationMs?: number; usage?: LlmUsage; costUsd?: number | null };
      } | null;
      const message = data?.message ?? null;
      const content = message?.content;
      if (!content) {
        continue;
      }
      const parsed = parseBidFromText(content, legalBids);
      if (parsed !== undefined) {
        return {
          bid: parsed,
          model,
          metrics: {
            durationMs: typeof data?.metrics?.durationMs === "number" ? data.metrics.durationMs : null,
            usage: data?.metrics?.usage ?? null,
            costUsd: typeof data?.metrics?.costUsd === "number" ? data.metrics.costUsd : null,
          },
        };
      }
    } catch {
      continue;
    }
  }

  return { bid: undefined, model: null, metrics: null };
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
  const trumpKnown = isTrumpKnownToPlayer(state, player);
  const trumpLine = formatTrumpLine(state, player);
  const seenCards = collectSeenCards(state);
  const seenBySuit = formatSeenCardsBySuit(seenCards);
  const seenTrumpRanks = trumpKnown && state.trumpSuit ? formatSeenTrumpRanks(seenCards, state.trumpSuit) : null;
  const outstandingTrumpRanks =
    trumpKnown && state.trumpSuit ? formatOutstandingTrumpRanks(seenCards, hand, state.trumpSuit) : null;
  const currentWinner = state.trick.plays.length
    ? winningPlay(state.trick, state.trumpSuit, state.trumpRevealed)
    : null;
  const partnerWinning = currentWinner ? teamForPlayer(currentWinner.player) === myTeam : false;

  const prompt = [
    'You are an expert 29 card game bot. Return JSON only with keys "rank" and "suit".',
    "Always choose from the provided legal moves.",
    "",
    "Strategy guardrails:",
    "- Preserve high-value cards (J=3, 9=2, A=1, 10=1) early unless winning a trick or forced to slough.",
    "- Avoid dumping the 9 or J early when a lower legal card exists and the trick is not guaranteed.",
    "- If it is early (tricks 1-3) and a 0-point legal card exists, do not play a point card unless it clearly wins the trick.",
    "- If you are unlikely to win the current trick, favor the lowest-point legal card.",
    "- When your partner is currently winning the trick and you can safely follow suit, prefer adding higher-point cards to secure the trick's points.",
    "- Prefer winning with the lowest necessary card; avoid overtrumping.",
    strategy,
    `Rules: Rank order ${RANK_ORDER_LABEL}. Last trick bonus: +1 (hand totals can sum to ${TOTAL_HAND_POINTS}).`,
    "",
    `Player: ${playerMeta.name} (${playerMeta.position}).`,
    `Your team: ${TEAM_LABELS[myTeam]}. Bidder: ${bidderLabel} (target ${bidTarget}).`,
    `Trick ${trickIndex} of 8. Lead suit: ${lead}.`,
    trumpLine,
    `Early trick: ${state.trickNumber < 3 ? "yes" : "no"}.`,
    `Score: Team A ${state.points[0]} pts, Team B ${state.points[1]} pts.`,
    `Current trick plays: ${currentTrick}.`,
    `Partner currently winning trick: ${partnerWinning ? "yes" : "no"}.`,
    `Seen cards by suit: ${seenBySuit}.`,
    seenTrumpRanks ? `Seen trump ranks: ${seenTrumpRanks}.` : null,
    outstandingTrumpRanks ? `Outstanding trump ranks (excluding your hand): ${outstandingTrumpRanks}.` : null,
    `Your hand: ${hand.map(cardLabel).join(", ")}.`,
    `Legal moves: ${legalMovesWithPoints}.`,
    "",
    "Respond with JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

  const modelQueue = Array.from(new Set([settings.model, ...settings.fallbackModels].filter(Boolean)));

  for (const model of modelQueue) {
    try {
      const response = await fetch("/api/openrouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: settings.temperature,
          trace: {
            source: "bot",
            matchRound: state.matchRound,
            trickNumber: state.trickNumber + 1,
            phase: state.phase,
            playerId: playerMeta.id,
            playerName: playerMeta.name,
            gameSeed: state.seed,
            turnId: state.log.length,
          },
          reasoning: {
            effort: settings.reasoningEffort,
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
        message?: { content?: string };
        metrics?: { durationMs?: number; usage?: LlmUsage; costUsd?: number | null };
      } | null;
      const message = data?.message ?? null;
      const content = message?.content;
      if (!content) {
        continue;
      }
      const parsed = parseCardFromText(content, legalMoves);
      if (parsed) {
        return {
          card: parsed,
          model,
          metrics: {
            durationMs: typeof data?.metrics?.durationMs === "number" ? data.metrics.durationMs : null,
            usage: data?.metrics?.usage ?? null,
            costUsd: typeof data?.metrics?.costUsd === "number" ? data.metrics.costUsd : null,
          },
        };
      }
    } catch {
      continue;
    }
  }

  return { card: null, model: null, metrics: null };
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
        plays: state.lastTrick.plays.map((play) => ({
          playerId: resolvedMeta[play.player].id,
          card: toPlayingCard(play.card),
        })),
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
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(DEFAULT_REASONING_EFFORT_BY_DIFFICULTY.easy);
  const [llmInUse, setLlmInUse] = useState(false);
  const [controlMode, setControlMode] = useState<ControlMode>("standard");
  const [controlModeLocked, setControlModeLocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showTrickResolution, setShowTrickResolution] = useState(false);
  const [lastAckTrick, setLastAckTrick] = useState<number | null>(null);

  const botTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickResolutionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedAckRef = useRef(false);
  const stateRef = useRef(engineState);
  const skipPresetRef = useRef(false);
  const logSessionIdRef = useRef<string | null>(null);
  const logSeqRef = useRef(0);
  const lastLogIndexRef = useRef<number | null>(null);
  const lastPhaseRef = useRef<EngineState["phase"] | null>(null);
  const lastTrickNumberRef = useRef<number | null>(null);

  const humanPlayers = useMemo(() => HUMAN_PLAYERS[controlMode], [controlMode]);
  const isHumanTurn = humanPlayers.includes(engineState.currentPlayer);
  const pendingTrickNumber = engineState.lastTrick?.number ?? null;
  const trickResolutionPending = pendingTrickNumber !== null && pendingTrickNumber !== lastAckTrick;

  const gameLoggingEnabled =
    typeof window !== "undefined" && process.env.NODE_ENV !== "test" && process.env.NEXT_PUBLIC_GAME_LOGGING !== "0";

  const getLogSessionId = useCallback(() => {
    if (logSessionIdRef.current) return logSessionIdRef.current;
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      logSessionIdRef.current = crypto.randomUUID();
      return logSessionIdRef.current;
    }
    const fallback = `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    logSessionIdRef.current = fallback;
    return fallback;
  }, []);

  const logGameEvent = useCallback(
    (event: Record<string, unknown>) => {
      if (!gameLoggingEnabled) return;
      const payload = {
        sessionId: getLogSessionId(),
        seq: logSeqRef.current++,
        ...event,
      };
      void fetch("/api/game-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    },
    [gameLoggingEnabled, getLogSessionId]
  );

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
    }),
    [botEnabled, preset, botModel, fallbackModels, botTemperature, reasoningEffort]
  );

  useEffect(() => {
    if (skipPresetRef.current) {
      skipPresetRef.current = false;
      return;
    }
    setBotTemperature(BOT_PRESETS[botDifficulty].temperature);
    setReasoningEffort(DEFAULT_REASONING_EFFORT_BY_DIFFICULTY[botDifficulty]);
  }, [botDifficulty]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!isPersistedState(parsed)) {
        window.localStorage.removeItem(STORAGE_KEY);
        setHydrated(true);
        return;
      }
      setEngineState(parsed.engineState);
      setLastMove(parsed.lastMove ?? null);
      if (typeof parsed.botEnabled === "boolean") {
        setBotEnabled(parsed.botEnabled);
      }
      if (parsed.botDifficulty === "easy" || parsed.botDifficulty === "medium" || parsed.botDifficulty === "hard") {
        skipPresetRef.current = true;
        setBotDifficulty(parsed.botDifficulty);
      }
      if (typeof parsed.botModel === "string" && parsed.botModel.length > 0) {
        setBotModel(parsed.botModel);
      }
      if (typeof parsed.botTemperature === "number" && Number.isFinite(parsed.botTemperature)) {
        setBotTemperature(parsed.botTemperature);
      }
      if (
        parsed.reasoningEffort === "xhigh" ||
        parsed.reasoningEffort === "high" ||
        parsed.reasoningEffort === "medium" ||
        parsed.reasoningEffort === "low" ||
        parsed.reasoningEffort === "minimal" ||
        parsed.reasoningEffort === "none"
      ) {
        setReasoningEffort(parsed.reasoningEffort);
      } else if (
        parsed.botDifficulty === "easy" ||
        parsed.botDifficulty === "medium" ||
        parsed.botDifficulty === "hard"
      ) {
        setReasoningEffort(DEFAULT_REASONING_EFFORT_BY_DIFFICULTY[parsed.botDifficulty]);
      }
      if (parsed.controlMode === "standard" || parsed.controlMode === "single-hand") {
        setControlMode(parsed.controlMode);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || hydratedAckRef.current) return;
    hydratedAckRef.current = true;
    setLastAckTrick(engineState.lastTrick?.number ?? null);
  }, [engineState.lastTrick?.number, hydrated]);

  useEffect(() => {
    stateRef.current = engineState;
  }, [engineState]);

  useEffect(() => {
    if (!hydrated) return;
    if (!gameLoggingEnabled) {
      lastLogIndexRef.current = engineState.log.length;
      lastPhaseRef.current = engineState.phase;
      lastTrickNumberRef.current = engineState.trickNumber;
      return;
    }

    const context = buildGameLogContext(engineState);
    const { trickNumber, leader, trumpSuit, trumpRevealed, ...contextWithoutTrickStart } = context;
    void trickNumber;
    void leader;
    void trumpSuit;
    void trumpRevealed;

    if (lastLogIndexRef.current === null) {
      lastLogIndexRef.current = engineState.log.length;
      lastPhaseRef.current = engineState.phase;
      lastTrickNumberRef.current = engineState.trickNumber;
      logGameEvent({
        type: "session-start",
        resumed: engineState.log.length > 0,
        hands: engineState.hands.map(handShortLabels),
        undealtCount: engineState.undealt.length,
        lastTrick: lastTrickSummary(engineState.lastTrick),
        ...context,
      });
      return;
    }

    let startIndex = lastLogIndexRef.current;
    if (engineState.log.length < startIndex) {
      logGameEvent({
        type: "log-reset",
        previousIndex: startIndex,
        newLength: engineState.log.length,
        ...context,
      });
      startIndex = 0;
      lastLogIndexRef.current = 0;
    }
    if (engineState.log.length > startIndex) {
      const newEntries = engineState.log.slice(startIndex);
      newEntries.forEach((message, idx) => {
        logGameEvent({
          type: "log",
          logIndex: startIndex + idx,
          message,
          ...context,
        });

        if (message.startsWith("Hand start.")) {
          logGameEvent({
            type: "hand-start",
            hands: engineState.hands.map(handShortLabels),
            undealtCount: engineState.undealt.length,
            ...context,
          });
        }

        if (message.startsWith("Bidding begins")) {
          logGameEvent({
            type: "bidding-start",
            hands: engineState.hands.map(handShortLabels),
            ...context,
          });
        }

        if (message.startsWith("Trick ") && engineState.lastTrick) {
          logGameEvent({
            type: "trick-end",
            lastTrick: lastTrickSummary(engineState.lastTrick),
            ...context,
          });
        }
      });
      lastLogIndexRef.current = engineState.log.length;
    }

    if (lastPhaseRef.current && lastPhaseRef.current !== engineState.phase) {
      logGameEvent({
        type: "phase-change",
        from: lastPhaseRef.current,
        to: engineState.phase,
        ...context,
      });
    }
    lastPhaseRef.current = engineState.phase;

    if (lastTrickNumberRef.current !== null && engineState.trickNumber !== lastTrickNumberRef.current) {
      if (engineState.phase === "playing") {
        logGameEvent({
          type: "trick-start",
          trickNumber: engineState.trickNumber + 1,
          leader: engineState.currentPlayer,
          trumpSuit: engineState.trumpSuit,
          trumpRevealed: engineState.trumpRevealed,
          ...contextWithoutTrickStart,
        });
      }
      if (engineState.phase === "hand-complete") {
        logGameEvent({
          type: "hand-complete",
          lastTrick: lastTrickSummary(engineState.lastTrick),
          ...context,
        });
      }
    }
    lastTrickNumberRef.current = engineState.trickNumber;
  }, [engineState, gameLoggingEnabled, hydrated, logGameEvent]);

  useEffect(() => {
    if (!trickResolutionPending || pendingTrickNumber === null) {
      if (trickResolutionTimer.current) {
        clearTimeout(trickResolutionTimer.current);
        trickResolutionTimer.current = null;
      }
      setShowTrickResolution(false);
      return;
    }

    if (trickResolutionTimer.current) {
      clearTimeout(trickResolutionTimer.current);
      trickResolutionTimer.current = null;
    }
    setShowTrickResolution(false);
    trickResolutionTimer.current = setTimeout(() => {
      setShowTrickResolution(true);
      trickResolutionTimer.current = null;
    }, TRICK_RESOLUTION_DELAY_MS);

    return () => {
      if (trickResolutionTimer.current) {
        clearTimeout(trickResolutionTimer.current);
        trickResolutionTimer.current = null;
      }
    };
  }, [pendingTrickNumber, trickResolutionPending]);

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

  const acknowledgeTrickResolution = useCallback(() => {
    if (!trickResolutionPending || pendingTrickNumber === null) return;
    setLastAckTrick(pendingTrickNumber);
    if (trickResolutionTimer.current) {
      clearTimeout(trickResolutionTimer.current);
      trickResolutionTimer.current = null;
    }
    setShowTrickResolution(false);
  }, [pendingTrickNumber, trickResolutionPending]);

  const resetTrickResolution = useCallback(() => {
    if (trickResolutionTimer.current) {
      clearTimeout(trickResolutionTimer.current);
      trickResolutionTimer.current = null;
    }
    setShowTrickResolution(false);
    setLastAckTrick(null);
  }, []);

  const legalCards = useMemo(() => {
    if (engineState.phase !== "playing") {
      return [];
    }
    if (trickResolutionPending) return [];
    if (engineState.matchWinner !== null) return [];
    if (!isHumanTurn) return [];
    const hand = engineState.hands[engineState.currentPlayer] ?? [];
    return getLegalPlays(hand, engineState.trick, {
      trumpSuit: engineState.trumpSuit,
      trumpRevealed: engineState.trumpRevealed,
      trumpFromSeventh: engineState.trumpFromSeventh,
    }).map(cardId);
  }, [engineState, isHumanTurn, trickResolutionPending]);

  const handlePlayCard = useCallback(
    (card: PlayingCard) => {
      if (engineState.phase !== "playing") return;
      if (trickResolutionPending) return;
      if (engineState.matchWinner !== null) return;
      if (!isHumanTurn) return;
      if (!legalCards.includes(card.id)) return;

      dispatch({
        type: "playCard",
        player: engineState.currentPlayer,
        card: { suit: card.suit, rank: card.rank },
      });
    },
    [dispatch, engineState, isHumanTurn, legalCards, trickResolutionPending]
  );

  const canBid = useMemo(
    () => engineState.phase === "bidding" && isHumanTurn && engineState.matchWinner === null,
    [engineState, isHumanTurn]
  );

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

  const canChooseTrump = useMemo(
    () => engineState.phase === "choose-trump" && isHumanTurn && engineState.matchWinner === null,
    [engineState, isHumanTurn]
  );

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
    resetTrickResolution();
    setLlmInUse(false);
    setEngineState((prev) =>
      createGameState({
        seed: prev.seed + 1,
        dealer: (prev.dealer + 1) % 4,
        config: prev.config,
      })
    );
    setLastMove(null);
    setControlModeLocked(false);
  }, [resetTrickResolution]);
  const canStartNextHand =
    engineState.phase === "hand-complete" && engineState.matchWinner === null && !trickResolutionPending;
  const handleNextHand = useCallback(() => {
    if (!canStartNextHand) return;
    if (botTimeout.current) {
      clearTimeout(botTimeout.current);
      botTimeout.current = null;
    }
    resetTrickResolution();
    setLlmInUse(false);
    setLastMove(null);
    dispatch({ type: "startNextHand" });
  }, [canStartNextHand, dispatch, resetTrickResolution]);

  const canRevealTrump = useMemo(() => {
    if (engineState.phase !== "playing") return false;
    if (trickResolutionPending) return false;
    if (engineState.matchWinner !== null) return false;
    if (engineState.trumpSuit === null) return false;
    if (engineState.trumpRevealed) return false;
    if (engineState.trumpFromSeventh) return false;
    if (!isHumanTurn) return false;
    const hand = engineState.hands[engineState.currentPlayer] ?? [];
    return shouldRevealTrump(hand, engineState.trick);
  }, [engineState, isHumanTurn, trickResolutionPending]);

  const handleRevealTrump = useCallback(() => {
    if (!canRevealTrump) return;
    dispatch({ type: "revealTrump", player: engineState.currentPlayer });
  }, [canRevealTrump, dispatch, engineState.currentPlayer]);

  const canDeclareRoyalsForHuman = useMemo(() => {
    if (engineState.phase !== "playing") return false;
    if (trickResolutionPending) return false;
    if (engineState.matchWinner !== null) return false;
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
  }, [engineState, isHumanTurn, trickResolutionPending]);

  const handleDeclareRoyals = useCallback(() => {
    if (!canDeclareRoyalsForHuman) return;
    dispatch({ type: "declareRoyals", player: engineState.currentPlayer });
  }, [canDeclareRoyalsForHuman, dispatch, engineState.currentPlayer]);

  useEffect(() => {
    if (!hydrated) return;
    if (trickResolutionPending) return;
    if (engineState.phase !== "playing") {
      setLlmInUse(false);
    }
    if (engineState.matchWinner !== null) return;
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
          let bidDecision: number | null | undefined = undefined;
          let llmDecision: LlmBidDecision | null = null;

          if (botSettings.enabled && shouldUseLLM()) {
            setLlmInUse(true);
            try {
              llmDecision = await requestLLMBid(snapshot, botSettings);
              bidDecision = llmDecision.bid;
            } finally {
              setLlmInUse(false);
            }
          }

          const fallback = chooseBotBidAmount(hand, snapshot.bidTarget, snapshot.config, botSettings.difficulty);
          const bid = bidDecision === undefined ? fallback.bid : bidDecision;
          const legalRaises = getLegalBidOptions(snapshot);

          const latest = stateRef.current;
          if (latest.currentPlayer !== botPlayer || latest.log.length !== turnId) {
            return;
          }
          logGameEvent({
            type: "bot-bid",
            source: bidDecision === undefined ? "fallback" : "llm",
            player: botPlayer,
            hand: handShortLabels(hand),
            currentBid: snapshot.bidTarget,
            minRaise: fallback.minRaise,
            legalRaises,
            decision: bid,
            fallbackProjection: {
              bestSuit: fallback.evaluation.bestSuit,
              trumpScore: round2(fallback.evaluation.trumpScore),
              sidePoints: round2(fallback.evaluation.sidePoints),
              strength: round2(fallback.evaluation.strength),
              desiredBid: fallback.evaluation.desiredBid,
              thresholds: fallback.evaluation.thresholds,
              stretch: fallback.evaluation.stretch,
            },
            llm: llmDecision
              ? {
                  model: llmDecision.model,
                  bid: llmDecision.bid ?? null,
                  durationMs: llmDecision.metrics?.durationMs ?? null,
                  usage: llmDecision.metrics?.usage ?? null,
                  costUsd: llmDecision.metrics?.costUsd ?? null,
                }
              : null,
            ...buildGameLogContext(latest),
          });
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
          logGameEvent({
            type: "bot-trump",
            player: botPlayer,
            hand: handShortLabels(hand),
            suit,
            ...buildGameLogContext(latest),
          });
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
          player: botPlayer,
          trumpSuit: snapshot.trumpSuit,
          trumpRevealed: snapshot.trumpRevealed,
          trumpFromSeventh: snapshot.trumpFromSeventh,
        });
        let llmDecision: LlmDecision | null = null;

        if (botSettings.enabled && shouldUseLLM()) {
          setLlmInUse(true);
          try {
            llmDecision = await requestLLMMove(snapshot, moves, botSettings);
            if (llmDecision.card) {
              chosen = llmDecision.card;
            }
          } finally {
            setLlmInUse(false);
          }
        }

        const latest = stateRef.current;
        if (latest.currentPlayer !== botPlayer || latest.log.length !== turnId) {
          return;
        }
        logGameEvent({
          type: "bot-play",
          source: llmDecision?.card ? "llm" : "fallback",
          player: botPlayer,
          hand: handShortLabels(hand),
          chosen: cardShortLabel(chosen),
          legalMoves: moves.map(cardShortLabel),
          trick: trickShortLabels(snapshot.trick),
          llm: llmDecision
            ? {
                model: llmDecision.model,
                card: llmDecision.card ? cardShortLabel(llmDecision.card) : null,
                durationMs: llmDecision.metrics?.durationMs ?? null,
                usage: llmDecision.metrics?.usage ?? null,
                costUsd: llmDecision.metrics?.costUsd ?? null,
              }
            : null,
          ...buildGameLogContext(latest),
        });
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
  }, [botSettings, dispatch, engineState, hydrated, isHumanTurn, logGameEvent, trickResolutionPending]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const payload: PersistedGameState = {
      version: STORAGE_VERSION,
      engineState,
      lastMove,
      botEnabled,
      botDifficulty,
      botModel,
      botTemperature,
      reasoningEffort,
      controlMode,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore write errors (quota, privacy mode).
    }
  }, [
    botDifficulty,
    botEnabled,
    botModel,
    botTemperature,
    controlMode,
    engineState,
    hydrated,
    lastMove,
    reasoningEffort,
  ]);

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
      resetTrickResolution();
      setLlmInUse(false);
      setEngineState((prev) =>
        createGameState({
          seed: prev.seed + 1,
          dealer: (prev.dealer + 1) % 4,
          config: prev.config,
        })
      );
      setLastMove(null);
    },
    [controlMode, controlModeLocked, resetTrickResolution]
  );

  const gameState = useMemo(() => createUiState(engineState, controlMode), [engineState, controlMode]);
  const trickResolutionSummary = trickResolutionPending ? gameState.lastTrick : null;
  const trickResolution = {
    pending: trickResolutionPending,
    open: showTrickResolution && trickResolutionPending,
    summary: trickResolutionSummary,
  };

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
    trickResolution,
    onAcknowledgeTrickResolution: acknowledgeTrickResolution,
    setBotEnabled,
    setBotDifficulty,
    setBotModel,
    setBotTemperature,
    setReasoningEffort,
    controlMode,
    controlModeLocked,
    onControlModeChange: handleControlModeChange,
  };
};

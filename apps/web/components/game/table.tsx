"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Hand } from "./hand";
import type { ControlMode, GameState, PlayingCard, Player, Suit } from "@/components/game/types";
import {
  LLM_MODEL_OPTIONS,
  REASONING_EFFORT_OPTIONS,
  type ReasoningEffort,
} from "@/components/game/use-game-controller";
import { Cog, RotateCcw } from "lucide-react";

interface GameTableProps {
  gameState: GameState;
  onPlayCard: (card: PlayingCard) => void;
  legalCardIds: string[];
  animationsEnabled: boolean;
  controlMode: ControlMode;
  onControlModeChange: (mode: ControlMode) => void;
  controlModeLocked: boolean;
  bidOptions: number[];
  canBid: boolean;
  onPlaceBid: (amount: number) => void;
  onPassBid: () => void;
  canChooseTrump: boolean;
  onChooseTrump: (suit: Suit | null) => void;
  onChooseTrumpFromSeventh: () => void;
  onNewGame: () => void;
  canRevealTrump: boolean;
  onRevealTrump: () => void;
  canDeclareRoyals: boolean;
  onDeclareRoyals: () => void;
  llmInUse: boolean;
  llmReasoning: string | null;
  llmReasoningMeta: {
    model: string;
    effort: ReasoningEffort;
    ts: number;
    hasTrace: boolean;
  } | null;
  showReasoningTrace: boolean;
}

const suitSymbols: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const JOKER_SYMBOL = "🃏";

const TRUMP_CHOICES: Array<{ suit: Suit; label: string; symbol: string }> = [
  { suit: "clubs", label: "Clubs", symbol: suitSymbols.clubs },
  { suit: "diamonds", label: "Diamonds", symbol: suitSymbols.diamonds },
  { suit: "hearts", label: "Hearts", symbol: suitSymbols.hearts },
  { suit: "spades", label: "Spades", symbol: suitSymbols.spades },
];

function getSuitColor(suit: Suit) {
  return suit === "hearts" || suit === "diamonds" ? "text-rose-500" : "text-slate-900";
}

function getPipPositions(rank: string): { x: number; y: number; inverted?: boolean }[] {
  const positions: Record<string, { x: number; y: number; inverted?: boolean }[]> = {
    A: [],
    "2": [
      { x: 50, y: 20 },
      { x: 50, y: 80, inverted: true },
    ],
    "3": [
      { x: 50, y: 20 },
      { x: 50, y: 50 },
      { x: 50, y: 80, inverted: true },
    ],
    "4": [
      { x: 30, y: 20 },
      { x: 70, y: 20 },
      { x: 30, y: 80, inverted: true },
      { x: 70, y: 80, inverted: true },
    ],
    "5": [
      { x: 30, y: 20 },
      { x: 70, y: 20 },
      { x: 50, y: 50 },
      { x: 30, y: 80, inverted: true },
      { x: 70, y: 80, inverted: true },
    ],
    "6": [
      { x: 30, y: 20 },
      { x: 70, y: 20 },
      { x: 30, y: 50 },
      { x: 70, y: 50 },
      { x: 30, y: 80, inverted: true },
      { x: 70, y: 80, inverted: true },
    ],
    "7": [
      { x: 30, y: 20 },
      { x: 70, y: 20 },
      { x: 50, y: 35 },
      { x: 30, y: 50 },
      { x: 70, y: 50 },
      { x: 30, y: 80, inverted: true },
      { x: 70, y: 80, inverted: true },
    ],
    "8": [
      { x: 30, y: 20 },
      { x: 70, y: 20 },
      { x: 50, y: 35 },
      { x: 30, y: 50 },
      { x: 70, y: 50 },
      { x: 50, y: 65, inverted: true },
      { x: 30, y: 80, inverted: true },
      { x: 70, y: 80, inverted: true },
    ],
    "9": [
      { x: 30, y: 15 },
      { x: 70, y: 15 },
      { x: 30, y: 37 },
      { x: 70, y: 37 },
      { x: 50, y: 50 },
      { x: 30, y: 63, inverted: true },
      { x: 70, y: 63, inverted: true },
      { x: 30, y: 85, inverted: true },
      { x: 70, y: 85, inverted: true },
    ],
    "10": [
      { x: 30, y: 15 },
      { x: 70, y: 15 },
      { x: 50, y: 28 },
      { x: 30, y: 40 },
      { x: 70, y: 40 },
      { x: 30, y: 60, inverted: true },
      { x: 70, y: 60, inverted: true },
      { x: 50, y: 72, inverted: true },
      { x: 30, y: 85, inverted: true },
      { x: 70, y: 85, inverted: true },
    ],
    J: [],
    Q: [],
    K: [],
  };
  return positions[rank] || [];
}

function isFaceCard(rank: string) {
  return ["J", "Q", "K"].includes(rank);
}

function PlayedCard({ card }: { card: PlayingCard }) {
  const suitColor = getSuitColor(card.suit);
  const suitColorBg = card.suit === "hearts" || card.suit === "diamonds" ? "bg-rose-50" : "bg-slate-50";
  const suitColorBorder = card.suit === "hearts" || card.suit === "diamonds" ? "border-rose-300" : "border-slate-300";
  const pips = getPipPositions(card.rank);
  const isFace = isFaceCard(card.rank);
  const isAce = card.rank === "A";

  return (
    <div className="relative h-[98px] w-[68px] md:h-[120px] md:w-[84px] rounded-xl bg-white/95 shadow-xl border border-slate-200/70 overflow-hidden">
      <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
        <span className={cn("text-[10px] md:text-xs font-semibold", suitColor)}>{card.rank}</span>
        <span className={cn("text-xs md:text-sm -mt-0.5", suitColor)}>{suitSymbols[card.suit]}</span>
      </div>

      <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
        <span className={cn("text-[10px] md:text-xs font-semibold", suitColor)}>{card.rank}</span>
        <span className={cn("text-xs md:text-sm -mt-0.5", suitColor)}>{suitSymbols[card.suit]}</span>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[42px] h-[68px] md:w-[52px] md:h-[86px]">
          {isAce ? (
            <div className="h-full flex items-center justify-center">
              <span className={cn("text-4xl md:text-5xl", suitColor)}>{suitSymbols[card.suit]}</span>
            </div>
          ) : isFace ? (
            <div
              className={cn(
                "h-full w-full rounded border-2 flex flex-col items-center justify-center gap-0.5",
                suitColorBorder,
                suitColorBg
              )}
            >
              <span className={cn("text-xl md:text-2xl font-semibold", suitColor)}>{card.rank}</span>
              <span className={cn("text-lg md:text-xl", suitColor)}>{suitSymbols[card.suit]}</span>
            </div>
          ) : (
            <div className="relative h-full w-full">
              {pips.map((pos, i) => (
                <span
                  key={i}
                  className={cn(
                    "absolute text-sm md:text-base transform -translate-x-1/2 -translate-y-1/2",
                    suitColor,
                    pos.inverted && "rotate-180"
                  )}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  {suitSymbols[card.suit]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardBack({ size = "small" }: { size?: "small" | "medium" }) {
  const sizeClasses = size === "small" ? "h-18 w-13 md:h-20 md:w-15" : "h-20 w-14 md:h-24 md:w-18";

  return (
    <div className={cn(sizeClasses, "rounded-lg bg-[#13261d] shadow-lg border border-white/15 overflow-hidden")}>
      <div className="w-full h-full p-1">
        <div
          className="w-full h-full rounded-md border border-white/15 bg-gradient-to-br from-white/10 via-transparent to-black/20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_6px)",
          }}
        />
      </div>
    </div>
  );
}

function StatusChip({
  label,
  value,
  highlight,
  className,
  title,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <div
      title={title}
      className={cn(
        "rounded-2xl border px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        highlight
          ? "border-[#f2c879]/70 bg-gradient-to-br from-[#f2c879] to-[#d9a74e] text-[#2b1c07]"
          : "border-white/12 bg-black/30 text-emerald-50",
        className
      )}
    >
      <div
        className={cn(
          "text-[10px] uppercase tracking-[0.28em]",
          highlight ? "text-[#2b1c07]/70" : "text-emerald-100/60"
        )}
      >
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function LiveAiIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      title="AI is thinking. Reasoning stays private."
      className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-emerald-100/70 shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
    >
      <Cog className="h-3 w-3 animate-[spin_3s_linear_infinite] text-[#f2c879]" />
      <span className="text-emerald-100/80">AI thinking</span>
      <span className="flex items-center gap-0.5">
        <span className="h-1 w-1 animate-pulse rounded-full bg-[#f2c879]/70" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-[#f2c879]/50 [animation-delay:150ms]" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-[#f2c879]/40 [animation-delay:300ms]" />
      </span>
    </div>
  );
}

const formatModelLabel = (value: string) => LLM_MODEL_OPTIONS.find((option) => option.value === value)?.label ?? value;

const formatEffortLabel = (value: ReasoningEffort) =>
  REASONING_EFFORT_OPTIONS.find((option) => option.value === value)?.label ?? value;

function ReasoningTracePanel({
  trace,
  meta,
  show,
}: {
  trace: string | null;
  meta: { model: string; effort: ReasoningEffort; ts: number; hasTrace: boolean } | null;
  show: boolean;
}) {
  if (!show) return null;
  const modelLabel = meta ? formatModelLabel(meta.model) : "—";
  const effortLabel = meta ? formatEffortLabel(meta.effort) : "—";
  const body = trace?.trim() ? trace : meta?.hasTrace ? "Trace unavailable for this model." : "No trace yet.";

  return (
    <div className="pointer-events-auto w-[min(22rem,78vw)] rounded-2xl border border-white/10 bg-black/70 p-3 text-[11px] text-emerald-100/70 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.3em] text-emerald-100/50">
        <span>Reasoning Trace</span>
        <span className="text-emerald-50">{effortLabel}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-emerald-100/60">
        <span className="uppercase tracking-[0.24em]">Model</span>
        <span className="text-emerald-50">{modelLabel}</span>
      </div>
      <div className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-2 text-emerald-100/70">
        {body}
      </div>
    </div>
  );
}

function OpponentArea({
  player,
  position,
  isTeammate,
  isActive,
}: {
  player: Player;
  position: "top" | "left" | "right";
  isTeammate: boolean;
  isActive: boolean;
}) {
  const cardCount = player.cards.length;
  const stackClass = cn(
    "flex items-center -space-x-6 md:-space-x-8 md:scale-[1.05]",
    isActive && "ring-2 ring-[#f2c879]/40 rounded-2xl p-2 shadow-[0_0_18px_rgba(242,200,121,0.2)]"
  );
  const topStackClass = cn(stackClass, "md:scale-[1.08]");

  if (position === "top") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", isTeammate ? "text-emerald-200" : "text-rose-200")}>
            {player.name}
          </span>
          {isTeammate && (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-200 border-emerald-400/40">
              Partner
            </Badge>
          )}
          {isActive && (
            <Badge variant="outline" className="text-[10px] bg-[#f2c879]/10 text-[#f2c879] border-[#f2c879]/40">
              Turn
            </Badge>
          )}
        </div>
        <div className={topStackClass}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <CardBack key={i} size="medium" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className={cn("text-sm font-medium", isTeammate ? "text-emerald-200" : "text-rose-200")}>
        {player.name}
      </span>
      <div className={stackClass}>
        {Array.from({ length: cardCount }).map((_, i) => (
          <CardBack key={i} size="medium" />
        ))}
      </div>
    </div>
  );
}

export function GameTable({
  gameState,
  onPlayCard,
  legalCardIds,
  animationsEnabled,
  controlMode,
  onControlModeChange,
  controlModeLocked,
  bidOptions,
  canBid,
  onPlaceBid,
  onPassBid,
  canChooseTrump,
  onChooseTrump,
  onChooseTrumpFromSeventh,
  onNewGame,
  canRevealTrump,
  onRevealTrump,
  canDeclareRoyals,
  onDeclareRoyals,
  llmInUse,
  llmReasoning,
  llmReasoningMeta,
  showReasoningTrace,
}: GameTableProps) {
  const bottomPlayer = gameState.players.find((p) => p.position === "bottom")!;
  const leftPlayer = gameState.players.find((p) => p.position === "left")!;
  const topPlayer = gameState.players.find((p) => p.position === "top")!;
  const rightPlayer = gameState.players.find((p) => p.position === "right")!;
  const isSingleHand = controlMode === "single-hand";

  const getPlayedCard = (playerId: string) => gameState.currentTrick.find((t) => t.playerId === playerId)?.card;

  const teamA = gameState.teams.teamA;
  const teamB = gameState.teams.teamB;
  const bidderName = gameState.bidWinner
    ? (gameState.players.find((p) => p.id === gameState.bidWinner)?.name ?? "-")
    : "--";
  const bidderTeamId = gameState.bidWinner ? (teamA.players.includes(gameState.bidWinner) ? "teamA" : "teamB") : null;
  const isNoTrump = gameState.trumpSuit === null && (gameState.phase === "playing" || gameState.phase === "finished");
  const trumpLabel = gameState.trumpSuit
    ? gameState.trumpRevealed
      ? suitSymbols[gameState.trumpSuit]
      : "Hidden"
    : isNoTrump
      ? `${JOKER_SYMBOL} Joker`
      : "Pending";
  const currentPlayerName = gameState.players.find((p) => p.id === gameState.currentPlayerId)?.name ?? "--";
  const isBidding = gameState.phase === "bidding";
  const isChoosingTrump = gameState.phase === "choose-trump";
  const royalsTeamId = gameState.royalsDeclaredBy;
  const royalsTeam = royalsTeamId ? (royalsTeamId === "teamA" ? teamA : teamB) : null;
  const royalsDirection = royalsTeamId && bidderTeamId ? (royalsTeamId === bidderTeamId ? "-" : "+") : "+/-";
  const royalsValue = isNoTrump
    ? "No trump"
    : royalsTeamId
      ? `${royalsTeam?.name ?? "Team"} ${royalsDirection}${gameState.royalsAdjustment}`
      : canDeclareRoyals
        ? `Available (${royalsDirection}${gameState.royalsAdjustment})`
        : "Not available";
  const showRoyalsStatus =
    !isNoTrump && (gameState.trumpRevealed || Boolean(gameState.royalsDeclaredBy) || canDeclareRoyals);
  const royalsTitle = isNoTrump
    ? "No-trump hands disable royals."
    : royalsTeamId
      ? `Royals declared by ${royalsTeam?.name ?? "Team"}. Target ${royalsDirection}${gameState.royalsAdjustment} (min ${gameState.royalsMinTarget}, max ${gameState.royalsMaxTarget}).`
      : `Declare with K+Q of trump after your team wins a trick post-reveal. Adjusts target by ${gameState.royalsAdjustment} (min ${gameState.royalsMinTarget}, max ${gameState.royalsMaxTarget}).`;
  const royalsClassName =
    royalsTeamId === "teamA"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-50"
      : royalsTeamId === "teamB"
        ? "border-rose-400/40 bg-rose-500/10 text-emerald-50"
        : undefined;
  const lastTrick = gameState.lastTrick;
  const lastTrickWinner = lastTrick ? gameState.players.find((p) => p.id === lastTrick.winnerPlayerId) : null;
  const lastTrickTeam = lastTrick ? (lastTrick.winnerTeamId === "teamA" ? teamA : teamB) : null;
  const lastTrickAccent = lastTrick
    ? lastTrick.winnerTeamId === "teamA"
      ? "text-emerald-200"
      : "text-rose-200"
    : "text-emerald-200";
  const lastTrickBadge = lastTrick
    ? lastTrick.winnerTeamId === "teamA"
      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
      : "border-rose-400/40 bg-rose-500/15 text-rose-100"
    : "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
  const lastTrickCardLabel = lastTrick
    ? `${lastTrick.winningCard.rank}${suitSymbols[lastTrick.winningCard.suit]}`
    : "--";

  const [selectedBid, setSelectedBid] = useState("");
  const bidValues = useMemo(() => bidOptions.map(String), [bidOptions]);
  const effectiveSelectedBid = bidValues.includes(selectedBid) ? selectedBid : (bidValues[0] ?? "");

  const [showTrickToast, setShowTrickToast] = useState(false);
  const lastTrickNumber = lastTrick?.trickNumber ?? null;

  useEffect(() => {
    if (lastTrickNumber === null) {
      const hideTimer = setTimeout(() => {
        setShowTrickToast(false);
      }, 0);
      return () => {
        clearTimeout(hideTimer);
      };
    }

    const showTimer = setTimeout(() => {
      setShowTrickToast(true);
    }, 0);
    const hideTimer = setTimeout(() => {
      setShowTrickToast(false);
    }, 2600);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [lastTrickNumber]);

  return (
    <TooltipProvider>
      <div className="relative h-full w-full p-4 md:p-8">
        {(llmInUse || showReasoningTrace) && (
          <div className="pointer-events-none absolute right-6 top-6 z-30 flex flex-col items-end gap-2">
            <LiveAiIndicator active={llmInUse} />
            <ReasoningTracePanel trace={llmReasoning} meta={llmReasoningMeta} show={showReasoningTrace} />
          </div>
        )}
        {lastTrick && (
          <div
            className={cn(
              "pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2 transition-all duration-300",
              showTrickToast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"
            )}
            aria-live="polite"
          >
            <div className="flex items-center gap-4 rounded-3xl border border-white/15 bg-[#0b1612]/95 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/60">
                  Trick {lastTrick.trickNumber} resolved
                </span>
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-50">
                  <span className={lastTrickAccent}>{lastTrickWinner?.name ?? "Player"}</span>
                  <span className="text-emerald-100/70">won</span>
                  <Badge className={cn("border text-[10px] uppercase tracking-[0.18em]", lastTrickBadge)}>
                    {lastTrickTeam?.name ?? "Team"}
                  </Badge>
                  <span className="text-emerald-50">+{lastTrick.points} pts</span>
                </div>
                <div className="text-xs text-emerald-100/70">
                  Winning card: <span className="text-emerald-50">{lastTrickCardLabel}</span>
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="origin-center scale-75 md:scale-90">
                  <PlayedCard card={lastTrick.winningCard} />
                </div>
              </div>
            </div>
          </div>
        )}
        {(isBidding || isChoosingTrump) && (
          <div className="pointer-events-none absolute left-1/2 top-6 z-30 w-[min(92vw,520px)] -translate-x-1/2 sm:top-10 md:hidden">
            <div className="pointer-events-auto rounded-[28px] border border-white/10 bg-[#0b1612]/95 p-5 shadow-[0_22px_60px_rgba(0,0,0,0.55)] backdrop-blur">
              {isBidding ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-emerald-50">Bidding</h2>
                    <Badge className="border-white/10 bg-white/5 text-emerald-100">
                      Min {gameState.royalsMinTarget} · Max {gameState.royalsMaxTarget}
                    </Badge>
                  </div>
                  <p className="text-xs text-emerald-100/70">
                    Bidding is based on the first four cards. The winner names trump or uses the 7th card before the
                    final deal.
                  </p>
                  <div className="text-sm text-emerald-100/70">
                    Current bid: <span className="text-emerald-50">{gameState.currentBid ?? "--"}</span>
                    {bidderName !== "--" && <span className="text-emerald-100/70"> · {bidderName}</span>}
                  </div>
                  <div className="text-xs uppercase tracking-[0.3em] text-emerald-100/60">
                    {canBid ? "Your turn to bid" : `Waiting for ${currentPlayerName}`}
                  </div>
                  {bidOptions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={effectiveSelectedBid} onValueChange={setSelectedBid} disabled={!canBid}>
                        <SelectTrigger className="h-9 min-w-[150px] rounded-full border-white/15 bg-white/5 text-emerald-50">
                          <SelectValue placeholder="Choose bid" />
                        </SelectTrigger>
                        <SelectContent>
                          {bidOptions.map((bid) => (
                            <SelectItem key={bid} value={String(bid)}>
                              Bid {bid}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => effectiveSelectedBid && onPlaceBid(Number(effectiveSelectedBid))}
                        size="sm"
                        disabled={!canBid || !effectiveSelectedBid}
                        className="h-9 rounded-full bg-[#f2c879] px-5 text-[#2b1c07] hover:bg-[#f8d690] disabled:opacity-50"
                      >
                        Place bid
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <Button
                      onClick={onPassBid}
                      size="sm"
                      disabled={!canBid}
                      className="h-9 rounded-full border border-white/15 bg-white/5 px-5 text-emerald-50 hover:bg-white/10 disabled:opacity-50"
                    >
                      Pass
                    </Button>
                    {!canBid && <span className="text-xs text-emerald-100/60">Bots are bidding…</span>}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-emerald-50">Choose Trump</h2>
                    <Badge className="border-white/10 bg-white/5 text-emerald-100">
                      Bid / Contract {gameState.currentBid ?? "--"}
                    </Badge>
                  </div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-100/60">
                    Bidding is based on the first four cards · Winner names trump, picks Joker, or uses the 7th card
                  </p>
                  <div className="text-sm text-emerald-100/70">
                    Bid winner: <span className="text-emerald-50">{bidderName}</span>
                  </div>
                  <div className="text-xs uppercase tracking-[0.3em] text-emerald-100/60">
                    {canChooseTrump
                      ? "Pick the trump suit, Joker (no trump), or use the 7th card"
                      : `Waiting for ${currentPlayerName}`}
                  </div>
                  {canChooseTrump && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {TRUMP_CHOICES.map((choice) => (
                          <Button
                            key={choice.suit}
                            onClick={() => onChooseTrump(choice.suit)}
                            size="sm"
                            className="h-10 rounded-full border border-white/10 bg-white/5 text-emerald-50 hover:bg-white/10"
                          >
                            <span className="mr-2 text-base">{choice.symbol}</span>
                            {choice.label}
                          </Button>
                        ))}
                        <Button
                          onClick={() => onChooseTrump(null)}
                          size="sm"
                          className="col-span-2 h-10 rounded-full border border-[#f2c879]/40 bg-gradient-to-r from-[#1a1306]/80 via-[#2a1a06]/70 to-[#1a1306]/80 text-[#f6d38b] shadow-[inset_0_0_18px_rgba(242,200,121,0.2)] hover:bg-[#f2c879]/10"
                        >
                          <span className="mr-2 text-base">{JOKER_SYMBOL}</span>
                          Joker
                          <span className="ml-2 text-[10px] uppercase tracking-[0.28em] text-[#f6d38b]/70">
                            No trump
                          </span>
                        </Button>
                      </div>
                      <Button
                        onClick={onChooseTrumpFromSeventh}
                        size="sm"
                        className="h-10 rounded-full border border-white/10 bg-white/5 text-emerald-50 hover:bg-white/10"
                      >
                        Use 7th card (hidden trump)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="absolute inset-4 md:inset-8 rounded-[28px] border border-white/10 bg-[var(--color-felt)] shadow-[0_30px_90px_rgba(0,0,0,0.55)] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(0,0,0,0.5),_transparent_70%)]" />
          <div className="absolute inset-6 rounded-[22px] border border-white/10" />
          <div className="absolute inset-6 rounded-[22px] border border-white/5 [background-image:repeating-linear-gradient(120deg,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_7px)]" />
        </div>

        <div className="relative h-full flex flex-col px-4 md:px-6 py-4">
          <div className="relative mt-2 px-3 py-2">
            <div className="pointer-events-none absolute inset-x-12 bottom-0 h-px bg-black/50" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge className="gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-emerald-50 shadow-[inset_0_0_12px_rgba(34,197,94,0.15)]">
                  <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]" />
                  <span className="text-[10px] uppercase tracking-[0.32em]">Solo Table</span>
                </Badge>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-emerald-100/60">
                  <span>Round</span>
                  <span className="text-emerald-50">{gameState.roundNumber}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip label="Bid / Contract" value={`${gameState.currentBid ?? "--"} · ${bidderName}`} />
                {showRoyalsStatus && (
                  <StatusChip
                    label="Royals (K+Q)"
                    value={royalsValue}
                    highlight={canDeclareRoyals}
                    title={royalsTitle}
                    className={royalsClassName}
                  />
                )}
                <StatusChip
                  label="Trump"
                  value={trumpLabel}
                  highlight={gameState.trumpRevealed}
                  className={cn(
                    canRevealTrump &&
                      !gameState.trumpRevealed &&
                      "ring-2 ring-[#f2c879]/30 shadow-[0_0_18px_rgba(242,200,121,0.25)]"
                  )}
                />
                <StatusChip label="Trick" value={`${Math.min(gameState.trickNumber + 1, 8)} / 8`} />
                {canRevealTrump && (
                  <Button
                    onClick={onRevealTrump}
                    size="sm"
                    title="Reveal trump (void in lead suit)"
                    className="h-9 rounded-full border border-[#f2c879]/50 bg-[#1a1306]/70 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#f6d38b] shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:bg-[#f2c879]/20"
                  >
                    Reveal Trump
                  </Button>
                )}
                {canDeclareRoyals && (
                  <Button
                    onClick={onDeclareRoyals}
                    size="sm"
                    title={royalsTitle}
                    className="h-9 rounded-full border border-[#f2c879]/60 bg-[#2a1a06]/80 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#f6d38b] shadow-[0_10px_28px_rgba(0,0,0,0.4)] hover:bg-[#f2c879]/20"
                  >
                    Declare Royals
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a1410]/70 via-black/40 to-[#123324]/40 px-4 py-2 text-xs text-emerald-100/70 shadow-[inset_0_0_18px_rgba(0,0,0,0.35)]">
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-emerald-200">{teamA.name}</span>
                    <span className="text-emerald-50">
                      {teamA.tricksWon} tricks · {teamA.handPoints} pts
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-6 border-t border-white/10 pt-1">
                    <span className="text-rose-200">{teamB.name}</span>
                    <span className="text-emerald-50">
                      {teamB.tricksWon} tricks · {teamB.handPoints} pts
                    </span>
                  </div>
                </div>
                <Button
                  onClick={onNewGame}
                  size="sm"
                  className="hidden sm:inline-flex md:hidden gap-2 bg-[#f2c879] text-[#2b1c07] hover:bg-[#f8d690]"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>New Game</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-6 pb-8">
            <OpponentArea player={topPlayer} position="top" isTeammate={true} isActive={topPlayer.isCurrentPlayer} />
          </div>

          <div className="flex-1 flex items-center justify-between px-10 md:px-20">
            <div className="flex-shrink-0">
              <OpponentArea
                player={leftPlayer}
                position="left"
                isTeammate={false}
                isActive={leftPlayer.isCurrentPlayer}
              />
            </div>

            <div className="flex-1 flex items-center justify-center">
              <div className="relative w-[17rem] h-[13rem] md:w-[19rem] md:h-[15rem]">
                <div className="absolute inset-0 rounded-3xl border border-white/20 bg-black/25 shadow-[inset_0_0_22px_rgba(0,0,0,0.35)]" />
                <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.08),transparent_58%)] opacity-70" />
                <div className="absolute top-3 left-1/2 -translate-x-1/2">
                  {getPlayedCard(topPlayer.id) ? (
                    <div className={cn(animationsEnabled && "animate-in fade-in slide-in-from-top-4 duration-300")}>
                      <PlayedCard card={getPlayedCard(topPlayer.id)!} />
                    </div>
                  ) : (
                    <div className="h-[100px] w-[70px] md:h-[120px] md:w-[84px] rounded-lg border-2 border-dashed border-white/20" />
                  )}
                </div>

                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  {getPlayedCard(leftPlayer.id) ? (
                    <div className={cn(animationsEnabled && "animate-in fade-in slide-in-from-left-4 duration-300")}>
                      <PlayedCard card={getPlayedCard(leftPlayer.id)!} />
                    </div>
                  ) : (
                    <div className="h-[100px] w-[70px] md:h-[120px] md:w-[84px] rounded-lg border-2 border-dashed border-white/20" />
                  )}
                </div>

                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {getPlayedCard(rightPlayer.id) ? (
                    <div className={cn(animationsEnabled && "animate-in fade-in slide-in-from-right-4 duration-300")}>
                      <PlayedCard card={getPlayedCard(rightPlayer.id)!} />
                    </div>
                  ) : (
                    <div className="h-[100px] w-[70px] md:h-[120px] md:w-[84px] rounded-lg border-2 border-dashed border-white/20" />
                  )}
                </div>

                <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                  {getPlayedCard(bottomPlayer.id) ? (
                    <div className={cn(animationsEnabled && "animate-in fade-in slide-in-from-bottom-4 duration-300")}>
                      <PlayedCard card={getPlayedCard(bottomPlayer.id)!} />
                    </div>
                  ) : (
                    <div className="h-[100px] w-[70px] md:h-[120px] md:w-[84px] rounded-lg border-2 border-dashed border-white/20" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex-shrink-0">
              <OpponentArea
                player={rightPlayer}
                position="right"
                isTeammate={false}
                isActive={rightPlayer.isCurrentPlayer}
              />
            </div>
          </div>

          <div className="pt-4 pb-12 md:pb-14 space-y-6">
            {isSingleHand && (
              <Hand
                player={topPlayer}
                onPlayCard={onPlayCard}
                isCurrentTurn={topPlayer.isCurrentPlayer}
                legalCardIds={legalCardIds}
                animationsEnabled={animationsEnabled}
              />
            )}
            <Hand
              player={bottomPlayer}
              onPlayCard={onPlayCard}
              isCurrentTurn={bottomPlayer.isCurrentPlayer}
              legalCardIds={legalCardIds}
              animationsEnabled={animationsEnabled}
            />
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center sm:hidden">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-2 shadow-[0_18px_40px_rgba(0,0,0,0.5)] backdrop-blur">
          <span className="text-[10px] uppercase tracking-[0.32em] text-emerald-100/60">
            Round {gameState.roundNumber}
          </span>
          <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1">
            {(["standard", "single-hand"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onControlModeChange(mode)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[9px] uppercase tracking-[0.22em] transition",
                  controlMode === mode ? "bg-[#f2c879] text-[#2b1c07]" : "text-emerald-100/70 hover:text-emerald-50",
                  controlModeLocked && "cursor-not-allowed",
                  controlModeLocked && (controlMode === mode ? "opacity-100" : "opacity-40")
                )}
                disabled={controlModeLocked}
              >
                {mode === "standard" ? "Standard" : "Single hand"}
              </button>
            ))}
          </div>
          <Button
            onClick={onNewGame}
            size="sm"
            className="gap-2 rounded-full bg-[#f2c879] text-[#2b1c07] hover:bg-[#f8d690]"
          >
            <RotateCcw className="h-4 w-4" />
            <span>New Game</span>
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

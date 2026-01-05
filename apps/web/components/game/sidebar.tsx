"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { MATCH_PIPS } from "@twentynine/engine";
import type { ControlMode, GameState, PlayingCard, Suit } from "@/components/game/types";
import {
  LLM_MODEL_OPTIONS,
  REASONING_EFFORT_OPTIONS,
  type BotDifficulty,
  type BotSettings,
  type ReasoningEffort,
} from "@/components/game/use-game-controller";
import { cn } from "@/lib/utils";
import { Settings, RotateCcw, Sparkles, ScrollText, Trophy } from "lucide-react";

interface GameSidebarProps {
  gameState: GameState;
  onNewGame: () => void;
  onOpenSettings: () => void;
  easyMode: boolean;
  botSettings: BotSettings;
  onBotEnabledChange: (enabled: boolean) => void;
  onBotDifficultyChange: (difficulty: BotDifficulty) => void;
  onBotModelChange: (model: string) => void;
  onBotTemperatureChange: (temperature: number) => void;
  onReasoningEffortChange: (effort: ReasoningEffort) => void;
  controlMode: ControlMode;
  onControlModeChange: (mode: ControlMode) => void;
  controlModeLocked: boolean;
  coachEnabled: boolean;
  onCoachEnabledChange: (enabled: boolean) => void;
  coachLoading: boolean;
  coachError: string | null;
  coachResponse: string | null;
  onRequestCoach: () => void;
  lastMoveSummary: string;
  legalMovesSummary: string;
  canRequestCoach: boolean;
  bidOptions: number[];
  canBid: boolean;
  onPlaceBid: (amount: number) => void;
  onPassBid: () => void;
  canChooseTrump: boolean;
  onChooseTrump: (suit: Suit | null) => void;
  onChooseTrumpFromSeventh: () => void;
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

const MATCH_CARD_BASE =
  "relative h-8 xl:h-9 w-6 xl:w-7 rounded-[0.5rem] border bg-gradient-to-br from-[#162820] via-[#0d1913] to-[#0a120e] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_12px_rgba(0,0,0,0.35)]";

const MATCH_PIP_STYLES = {
  red: "bg-[#e85b5b] ring-1 ring-rose-200/60 shadow-[0_0_10px_rgba(232,91,91,0.45)]",
  black: "bg-[#0a0a0a] ring-1 ring-white/30 shadow-[inset_0_0_6px_rgba(255,255,255,0.15)]",
  empty: "bg-white/10 ring-1 ring-white/10",
} as const;

const isRedSuit = (suit: Suit) => suit === "hearts" || suit === "diamonds";

function TrickCard({ card, isWinner }: { card: PlayingCard; isWinner?: boolean }) {
  const suitTone = isRedSuit(card.suit) ? "text-rose-500" : "text-slate-900";
  const borderTone = isRedSuit(card.suit) ? "border-rose-200/70" : "border-slate-200/70";

  return (
    <div
      className={cn(
        "relative h-[clamp(56px,5vw,84px)] w-[clamp(40px,3.6vw,60px)] rounded-md border bg-white/95 bg-gradient-to-br from-white/98 via-white/94 to-white/86 shadow-[0_10px_20px_rgba(0,0,0,0.25)] backdrop-blur-[2px]",
        borderTone,
        isWinner && "ring-2 ring-[#f2c879]/80 shadow-[0_0_18px_rgba(242,200,121,0.55)]"
      )}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <div className={cn("absolute left-1 top-0.5 text-[clamp(10px,0.75vw,12px)] font-semibold", suitTone)}>
        {card.rank}
      </div>
      <div className={cn("absolute right-1 bottom-0.5 text-[clamp(10px,0.75vw,12px)] font-semibold", suitTone)}>
        {card.rank}
      </div>
      <div className={cn("absolute inset-0 flex items-center justify-center text-[clamp(16px,1.35vw,22px)]", suitTone)}>
        {suitSymbols[card.suit]}
      </div>
    </div>
  );
}

export function GameSidebar({
  gameState,
  onNewGame,
  onOpenSettings,
  easyMode,
  botSettings,
  onBotEnabledChange,
  onBotDifficultyChange,
  onBotModelChange,
  onBotTemperatureChange,
  onReasoningEffortChange,
  controlMode,
  onControlModeChange,
  controlModeLocked,
  coachEnabled,
  onCoachEnabledChange,
  coachLoading,
  coachError,
  coachResponse,
  onRequestCoach,
  lastMoveSummary,
  legalMovesSummary,
  canRequestCoach,
  bidOptions,
  canBid,
  onPlaceBid,
  onPassBid,
  canChooseTrump,
  onChooseTrump,
  onChooseTrumpFromSeventh,
}: GameSidebarProps) {
  const [selectedBid, setSelectedBid] = useState("");
  const bidValues = useMemo(() => bidOptions.map(String), [bidOptions]);
  const effectiveSelectedBid = bidValues.includes(selectedBid) ? selectedBid : (bidValues[0] ?? "");
  const modelLabel = LLM_MODEL_OPTIONS.find((option) => option.value === botSettings.model)?.label ?? botSettings.model;
  const effortLabel =
    REASONING_EFFORT_OPTIONS.find((option) => option.value === botSettings.reasoningEffort)?.label ??
    botSettings.reasoningEffort;
  const fallbackLabels = botSettings.fallbackModels
    .map((model) => LLM_MODEL_OPTIONS.find((option) => option.value === model)?.label ?? model)
    .join(", ");

  const teamA = gameState.teams.teamA;
  const teamB = gameState.teams.teamB;
  const bidderName = gameState.bidWinner
    ? (gameState.players.find((player) => player.id === gameState.bidWinner)?.name ?? "-")
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
  const currentPlayer = gameState.players.find((player) => player.id === gameState.currentPlayerId)?.name ?? "-";
  const controlLabel = controlMode === "single-hand" ? "Single hand" : "Standard";
  const controlDescription =
    controlMode === "single-hand" ? "You control both Team A hands." : "You control your own hand.";
  const controlModeNote = controlModeLocked
    ? gameState.phase === "playing" || gameState.phase === "finished"
      ? "Locked after the 8-card deal."
      : "Locked for this hand."
    : "Choose once; locks after the 8-card deal.";
  const phaseLabel = gameState.phase.replace("-", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const isBidding = gameState.phase === "bidding";
  const isChoosingTrump = gameState.phase === "choose-trump";
  const royalsTeamId = gameState.royalsDeclaredBy;
  const royalsTeam = royalsTeamId ? (royalsTeamId === "teamA" ? teamA : teamB) : null;
  const royalsDirection = royalsTeamId && bidderTeamId ? (royalsTeamId === bidderTeamId ? "-" : "+") : "+/-";
  const royalsStatus = isNoTrump
    ? "No trump"
    : royalsTeamId
      ? `${royalsTeam?.name ?? "Team"} ${royalsDirection}${gameState.royalsAdjustment}`
      : "None declared";
  const royalsBadgeClass = isNoTrump
    ? "border-[#f2c879]/40 bg-[#f2c879]/10 text-[#f6d38b]"
    : royalsTeamId === "teamA"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
      : royalsTeamId === "teamB"
        ? "border-rose-400/40 bg-rose-500/10 text-emerald-100"
        : "border-white/10 bg-white/5 text-emerald-50";
  const teamARed = gameState.matchRedPips[0];
  const teamABlack = gameState.matchBlackPips[0];
  const teamBRed = gameState.matchRedPips[1];
  const teamBBlack = gameState.matchBlackPips[1];
  const playerLabels = useMemo(() => gameState.players.map((player) => player.name), [gameState.players]);
  const fullLog = useMemo(
    () =>
      gameState.log.map((entry) =>
        entry.replace(/\bP([1-4])\b/g, (_, index) => playerLabels[Number(index) - 1] ?? `P${index}`)
      ),
    [gameState.log, playerLabels]
  );
  const displayLog = easyMode ? fullLog : [];
  const lastTrick = gameState.lastTrick;
  const lastTrickWinner = lastTrick ? gameState.players.find((player) => player.id === lastTrick.winnerPlayerId) : null;
  const lastTrickTeam = lastTrick ? (lastTrick.winnerTeamId === "teamA" ? teamA : teamB) : null;
  const lastTrickPlays = lastTrick?.plays ?? [];

  const formatMatchScore = (red: number, black: number) => {
    return `R${red}/${MATCH_PIPS} · B${black}/${MATCH_PIPS}`;
  };

  const renderMatchRow = (teamId: "teamA" | "teamB", tone: "red" | "black") => {
    const teamIndex = teamId === "teamA" ? 0 : 1;
    const filledCount = tone === "red" ? gameState.matchRedPips[teamIndex] : gameState.matchBlackPips[teamIndex];
    const teamBorder = teamId === "teamA" ? "border-emerald-400/25" : "border-rose-400/25";
    const pipClass = tone === "red" ? MATCH_PIP_STYLES.red : MATCH_PIP_STYLES.black;
    const title = tone === "red" ? "Red pips (made bid)" : "Black pips (missed bid)";

    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label={`${title} for ${teamId}`}>
        {Array.from({ length: MATCH_PIPS }, (_, index) => {
          const active = index < filledCount;
          const pipTone = active ? pipClass : MATCH_PIP_STYLES.empty;

          return (
            <div key={`${teamId}-${tone}-${index}`} title={title} className={cn(MATCH_CARD_BASE, teamBorder)}>
              <span
                className={cn(
                  "absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                  pipTone
                )}
              />
              <span className="pointer-events-none absolute inset-[3px] rounded-[0.4rem] border border-white/5" />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <aside className="hidden md:flex w-80 xl:w-96 2xl:w-[26rem] shrink-0 flex-col border-r border-white/10 bg-[#0c1813]">
      <div className="p-5 xl:p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-[clamp(18px,1.6vw,24px)] font-serif text-emerald-50">Solo Table</h1>
            <p className="text-[clamp(11px,0.85vw,13px)] uppercase tracking-[0.35em] text-emerald-100/60">
              Round {gameState.matchRound}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onOpenSettings} className="text-emerald-100/70">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex-1 min-h-0">
        <TabsList className="mx-4 mt-3 grid h-9 grid-cols-3 text-[clamp(12px,0.95vw,14px)]">
          <TabsTrigger
            value="overview"
            className="gap-2 text-[clamp(12px,0.95vw,14px)] data-[state=active]:bg-emerald-300/20 data-[state=active]:text-emerald-100 data-[state=active]:shadow-[inset_0_0_16px_rgba(16,185,129,0.28)] data-[state=active]:font-semibold"
          >
            <Trophy className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only">Overview</span>
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="gap-2 text-[clamp(12px,0.95vw,14px)] data-[state=active]:bg-emerald-300/20 data-[state=active]:text-emerald-100 data-[state=active]:shadow-[inset_0_0_16px_rgba(16,185,129,0.28)] data-[state=active]:font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only">AI</span>
          </TabsTrigger>
          <TabsTrigger
            value="log"
            className="gap-2 text-[clamp(12px,0.95vw,14px)] data-[state=active]:bg-emerald-300/20 data-[state=active]:text-emerald-100 data-[state=active]:shadow-[inset_0_0_16px_rgba(16,185,129,0.28)] data-[state=active]:font-semibold"
          >
            <ScrollText className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only">Log</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 min-h-0 px-4 xl:px-5">
          <TabsContent value="overview" className="mt-3 space-y-2">
            <Card className="gap-2 py-2.5 bg-[#0a1712]/90 border border-emerald-500/20 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
              <CardHeader className="pb-0 gap-1">
                <CardTitle className="text-[clamp(12px,0.95vw,14px)] text-emerald-50">Control Mode</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <p className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/70">{controlDescription}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["standard", "single-hand"] as const).map((mode) => (
                    <Button
                      key={mode}
                      size="sm"
                      onClick={() => onControlModeChange(mode)}
                      className={cn(
                        "h-8 xl:h-9 rounded-full border px-3.5 text-[clamp(10px,0.8vw,12px)] uppercase tracking-[0.16em]",
                        controlMode === mode
                          ? "border-[#f2c879] bg-[#f2c879] text-[#2b1c07] hover:bg-[#f8d690]"
                          : "border-white/15 bg-white/5 text-emerald-50 hover:bg-white/10",
                        controlModeLocked && "cursor-not-allowed",
                        controlModeLocked && (controlMode === mode ? "opacity-100" : "opacity-40")
                      )}
                      disabled={controlModeLocked}
                    >
                      {mode === "standard" ? "Standard" : "Single hand"}
                    </Button>
                  ))}
                </div>
                <p className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/60 leading-snug">{controlModeNote}</p>
              </CardContent>
            </Card>

            {(isBidding || isChoosingTrump) && (
              <Card className="gap-2 py-3 bg-[#08120e]/80 border border-emerald-400/20 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                <CardHeader className="pb-0 gap-1">
                  <CardTitle className="text-[clamp(12px,0.95vw,14px)] text-emerald-50">
                    {isBidding ? "Bidding" : "Choose Trump"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-1.5 text-[clamp(11px,0.85vw,13px)] text-emerald-100/70">
                  {isBidding && (
                    <p className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/65">
                      Bidding is based on the first four cards. The winner names trump, picks Joker (no trump), or uses
                      the 7th card before the final deal.
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[clamp(11px,0.85vw,13px)]">
                    <span className="text-emerald-100/70">Current bid</span>
                    <span className="text-emerald-50">
                      {gameState.currentBid ?? "--"}
                      {bidderName !== "--" && ` · ${bidderName}`}
                    </span>
                  </div>
                  <div className="text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.3em] text-emerald-100/60">
                    {isBidding
                      ? canBid
                        ? "Your turn to bid"
                        : `Waiting for ${currentPlayer}`
                      : canChooseTrump
                        ? "Pick the trump suit, Joker (no trump), or use the 7th card"
                        : `Waiting for ${currentPlayer}`}
                  </div>
                  {isBidding && bidOptions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Select value={effectiveSelectedBid} onValueChange={setSelectedBid} disabled={!canBid}>
                        <SelectTrigger className="h-9 xl:h-10 min-w-[150px] rounded-full border-white/20 bg-white/5 text-[clamp(12px,0.95vw,14px)] text-emerald-50 shadow-[0_0_0_1px_rgba(242,200,121,0.15)]">
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
                        size="sm"
                        disabled={!canBid || !effectiveSelectedBid}
                        onClick={() => effectiveSelectedBid && onPlaceBid(Number(effectiveSelectedBid))}
                        className="h-9 xl:h-10 rounded-full bg-[#f2c879] px-5 text-[clamp(12px,0.95vw,14px)] font-semibold text-[#2b1c07] shadow-[0_10px_24px_rgba(0,0,0,0.35)] hover:bg-[#f8d690] disabled:opacity-50"
                      >
                        Place bid
                      </Button>
                    </div>
                  )}
                  {isBidding && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        onClick={onPassBid}
                        size="sm"
                        disabled={!canBid}
                        className="h-9 xl:h-10 rounded-full border border-white/15 bg-white/5 px-4 text-[clamp(11px,0.85vw,13px)] text-emerald-50 hover:bg-white/10 disabled:opacity-50"
                      >
                        Pass
                      </Button>
                      {!canBid && (
                        <span className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/60">Bots are bidding…</span>
                      )}
                    </div>
                  )}
                  {isChoosingTrump && canChooseTrump && (
                    <div className="space-y-2 pt-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        {TRUMP_CHOICES.map((choice) => (
                          <Button
                            key={choice.suit}
                            size="sm"
                            onClick={() => onChooseTrump(choice.suit)}
                            className="h-9 xl:h-10 rounded-full border border-white/10 bg-white/5 text-emerald-50 hover:bg-white/10"
                          >
                            <span className="mr-2 text-[clamp(14px,1.1vw,16px)]">{choice.symbol}</span>
                            {choice.label}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          onClick={() => onChooseTrump(null)}
                          className="col-span-2 h-9 xl:h-10 rounded-full border border-[#f2c879]/40 bg-gradient-to-r from-[#1a1306]/80 via-[#2a1a06]/70 to-[#1a1306]/80 text-[#f6d38b] shadow-[inset_0_0_18px_rgba(242,200,121,0.2)] hover:bg-[#f2c879]/10"
                        >
                          <span className="mr-2 text-[clamp(14px,1.1vw,16px)]">{JOKER_SYMBOL}</span>
                          Joker
                          <span className="ml-2 text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.28em] text-[#f6d38b]/70">
                            No trump
                          </span>
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        onClick={onChooseTrumpFromSeventh}
                        className="h-9 xl:h-10 rounded-full border border-white/10 bg-white/5 text-emerald-50 hover:bg-white/10"
                      >
                        Use 7th card (hidden trump)
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="gap-2 py-3 bg-black/40 border-white/10">
              <CardHeader className="pb-0 gap-1">
                <CardTitle className="text-[clamp(12px,0.95vw,14px)] text-emerald-50">Round Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5 text-[clamp(12px,0.95vw,14px)] text-emerald-100/70">
                <div className="flex items-center justify-between">
                  <span>Phase</span>
                  <Badge className="border-white/10 bg-white/5 text-emerald-50">{phaseLabel}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Controls</span>
                  <span className="text-emerald-50">{controlLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Current Player</span>
                  <span className="text-emerald-50">{currentPlayer}</span>
                </div>
                <Separator className="bg-white/10 my-1.5" />
                <div className="flex items-center justify-between">
                  <span>Bid / Contract</span>
                  <span className="text-emerald-50">{gameState.currentBid ?? "--"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Bidder</span>
                  <span className="text-emerald-50">{bidderName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Trump</span>
                  <span className="text-emerald-50">{trumpLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Trick</span>
                  <span className="text-emerald-50">{Math.min(gameState.trickNumber + 1, 8)} / 8</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Royals (K+Q)</span>
                  <Badge className={royalsBadgeClass}>{royalsStatus}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-2 py-3 bg-black/40 border-white/10">
              <CardHeader className="pb-0 gap-1">
                <CardTitle className="text-[clamp(12px,0.95vw,14px)] text-emerald-50">Key Rules</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-[clamp(11px,0.85vw,13px)] leading-relaxed text-emerald-100/70 space-y-1.5">
                <p>
                  • Bidding is based on the first four cards; the winner names trump, picks Joker, or uses the 7th card.
                </p>
                <p>• After trump is set, each player receives their final four cards.</p>
                <p>
                  • Must follow suit if possible; trump stays hidden until someone can&apos;t follow suit (then they can
                  reveal it).
                </p>
                <p>• Joker = no trump; highest card of the led suit wins.</p>
                <p>• Last trick grants the 29th point; royals (K+Q of trump) adjust target +/-4.</p>
              </CardContent>
            </Card>

            <Card className="gap-2 py-3 bg-black/40 border-white/10">
              <CardHeader className="pb-0 gap-1">
                <CardTitle className="text-[clamp(12px,0.95vw,14px)] text-emerald-50">Teams</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-[clamp(12px,0.95vw,14px)]">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-200">{teamA.name}</span>
                    <span className="text-emerald-50">
                      {teamA.tricksWon} tricks · {teamA.handPoints} pts
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.3em] text-emerald-100/60">
                    <span>Match Pips</span>
                    <span className="text-emerald-50">{formatMatchScore(teamARed, teamABlack)}</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.28em] text-emerald-100/60">
                      <span className="flex items-center gap-2">
                        <span className={cn("size-1.5 rounded-full", MATCH_PIP_STYLES.red)} />
                        Red pips
                      </span>
                      <span className="text-emerald-50">
                        {teamARed}/{MATCH_PIPS}
                      </span>
                    </div>
                    {renderMatchRow("teamA", "red")}
                    <div className="flex items-center justify-between text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.28em] text-emerald-100/60">
                      <span className="flex items-center gap-2">
                        <span className={cn("size-1.5 rounded-full", MATCH_PIP_STYLES.black)} />
                        Black pips
                      </span>
                      <span className="text-emerald-50">
                        {teamABlack}/{MATCH_PIPS}
                      </span>
                    </div>
                    {renderMatchRow("teamA", "black")}
                  </div>
                </div>
                <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-rose-200">{teamB.name}</span>
                    <span className="text-emerald-50">
                      {teamB.tricksWon} tricks · {teamB.handPoints} pts
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.3em] text-emerald-100/60">
                    <span>Match Pips</span>
                    <span className="text-emerald-50">{formatMatchScore(teamBRed, teamBBlack)}</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.28em] text-emerald-100/60">
                      <span className="flex items-center gap-2">
                        <span className={cn("size-1.5 rounded-full", MATCH_PIP_STYLES.red)} />
                        Red pips
                      </span>
                      <span className="text-emerald-50">
                        {teamBRed}/{MATCH_PIPS}
                      </span>
                    </div>
                    {renderMatchRow("teamB", "red")}
                    <div className="flex items-center justify-between text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.28em] text-emerald-100/60">
                      <span className="flex items-center gap-2">
                        <span className={cn("size-1.5 rounded-full", MATCH_PIP_STYLES.black)} />
                        Black pips
                      </span>
                      <span className="text-emerald-50">
                        {teamBBlack}/{MATCH_PIPS}
                      </span>
                    </div>
                    {renderMatchRow("teamB", "black")}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.28em] text-emerald-100/50">
                  <span className="inline-flex items-center gap-1">
                    <span className={cn("size-1.5 rounded-full", MATCH_PIP_STYLES.red)} />
                    made bid
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className={cn("size-1.5 rounded-full", MATCH_PIP_STYLES.black)} />
                    missed bid
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="mt-3 space-y-2">
            <Card className="gap-2 py-3 bg-black/40 border-white/10">
              <CardHeader className="pb-1 gap-1">
                <CardTitle className="text-[clamp(12px,0.95vw,14px)] flex items-center gap-2 text-emerald-50">
                  <Sparkles className="h-4 w-4 text-[#f2c879]" />
                  LLM Bots
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[clamp(12px,0.95vw,14px)] font-medium text-emerald-50">Play against AI bots</p>
                    <p className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/60">
                      Let bots consult an advanced model for every move.
                    </p>
                  </div>
                  <Switch checked={botSettings.enabled} onCheckedChange={onBotEnabledChange} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/60">Difficulty</p>
                  <Select
                    value={botSettings.difficulty}
                    onValueChange={(value) => onBotDifficultyChange(value as BotDifficulty)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/60">{botSettings.usageHint}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[clamp(11px,0.85vw,13px)] text-emerald-100/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.28em] text-emerald-100/50">
                      Model
                    </span>
                    <span className="text-emerald-50">{modelLabel}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[clamp(11px,0.85vw,13px)] text-emerald-100/70">
                    <span>Reasoning</span>
                    <span className="text-emerald-50">{effortLabel}</span>
                  </div>
                </div>
                <Accordion type="single" collapsible className="rounded-lg border border-white/10 bg-black/30 px-3">
                  <AccordionItem value="advanced" className="border-none">
                    <AccordionTrigger className="py-2 text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.32em] text-emerald-100/50 hover:no-underline">
                      Advanced AI
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 text-[clamp(11px,0.85vw,13px)] text-emerald-100/70">
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <p className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/60">Model</p>
                          <Select value={botSettings.model} onValueChange={onBotModelChange}>
                            <SelectTrigger className="h-9 xl:h-10 border-white/15 bg-white/5 text-emerald-50">
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                              {LLM_MODEL_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/60">Reasoning effort</p>
                          <Select
                            value={botSettings.reasoningEffort}
                            onValueChange={(value) => onReasoningEffortChange(value as ReasoningEffort)}
                          >
                            <SelectTrigger className="h-9 xl:h-10 border-white/15 bg-white/5 text-emerald-50">
                              <SelectValue placeholder="Select effort" />
                            </SelectTrigger>
                            <SelectContent>
                              {REASONING_EFFORT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/55">
                            Higher effort spends more tokens to evaluate lines of play.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[clamp(11px,0.85vw,13px)] text-emerald-100/60">
                            <span>Temperature</span>
                            <span className="text-emerald-50">{botSettings.temperature.toFixed(2)}</span>
                          </div>
                          <Slider
                            value={[botSettings.temperature]}
                            onValueChange={(value) => onBotTemperatureChange(value[0] ?? 0)}
                            max={1}
                            step={0.05}
                            className="w-full"
                          />
                        </div>
                        <p className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/55">
                          Fallbacks: {fallbackLabels}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card className="gap-2 py-3 bg-black/40 border-white/10">
              <CardHeader className="pb-1 gap-1">
                <CardTitle className="text-[clamp(12px,0.95vw,14px)] text-emerald-50">AI Coach</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[clamp(12px,0.95vw,14px)] font-medium text-emerald-50">Coach my turn</p>
                    <p className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/60">
                      Get a quick recap and a play suggestion.
                    </p>
                  </div>
                  <Switch checked={coachEnabled} onCheckedChange={onCoachEnabledChange} />
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-[clamp(11px,0.85vw,13px)] text-emerald-100/60 space-y-1">
                  <p>
                    <span className="font-medium text-emerald-50">Last move:</span> {lastMoveSummary}
                  </p>
                  <p>
                    <span className="font-medium text-emerald-50">Your legal moves:</span> {legalMovesSummary}
                  </p>
                </div>
                <Button onClick={onRequestCoach} disabled={!canRequestCoach} className="w-full">
                  {coachLoading ? "Analyzing..." : "Coach my turn"}
                </Button>
                {coachError && <p className="text-[clamp(11px,0.85vw,13px)] text-rose-300">{coachError}</p>}
                {coachResponse && (
                  <div className="rounded-lg border border-white/10 bg-white/90 p-2.5 text-[clamp(11px,0.85vw,13px)] text-slate-900 leading-relaxed whitespace-pre-wrap">
                    {coachResponse}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="log" className="mt-3 space-y-2">
            <Card className="gap-2 py-3 bg-black/40 border-white/10">
              <CardHeader className="pb-1 gap-1">
                <CardTitle className="text-[clamp(12px,0.95vw,14px)] text-emerald-50">Trick Log</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lastTrick ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.28em] text-emerald-100/60">
                          Trick {lastTrick.trickNumber}
                        </p>
                        <p className="text-[clamp(12px,0.95vw,14px)] text-emerald-50">
                          {lastTrickWinner?.name ?? "Player"} won
                        </p>
                        <p className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/70">
                          {lastTrickTeam?.name ?? "Team"} · +{lastTrick.points} pts
                        </p>
                      </div>
                      <Badge className="border-white/10 bg-white/5 text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.18em] text-emerald-100">
                        +{lastTrick.points}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {lastTrickPlays.map((play) => {
                        const playerName =
                          gameState.players.find((player) => player.id === play.playerId)?.name ?? "Player";
                        return (
                          <div
                            key={`${play.playerId}-${play.card.id}`}
                            className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-2"
                          >
                            <TrickCard card={play.card} isWinner={play.playerId === lastTrick.winnerPlayerId} />
                            <span className="text-[clamp(10px,0.75vw,12px)] text-emerald-100/70">{playerName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/70">No tricks yet.</p>
                )}
                {easyMode && (
                  <div className="space-y-2 border-t border-white/10 pt-3">
                    <p className="text-[clamp(10px,0.75vw,12px)] uppercase tracking-[0.28em] text-emerald-100/60">
                      Full trick log
                    </p>
                    <div className="space-y-1 text-[clamp(11px,0.85vw,13px)] text-emerald-100/70">
                      {displayLog.length === 0 ? (
                        <p>No actions yet.</p>
                      ) : (
                        displayLog.map((entry, index) => <p key={index}>• {entry}</p>)
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <div className="p-4 border-t border-white/10 space-y-2">
        <Button onClick={onNewGame} className="w-full gap-2 bg-[#f2c879] text-[#2b1c07] hover:bg-[#f8d690]">
          <RotateCcw className="h-4 w-4" />
          New Match
        </Button>
      </div>
    </aside>
  );
}

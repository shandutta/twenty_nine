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
import type { ControlMode, GameState, MatchTrack, Suit } from "@/components/game/types";
import type { BotDifficulty, BotSettings } from "@/components/game/use-game-controller";
import { cn } from "@/lib/utils";
import { Settings, RotateCcw, Sparkles, ScrollText, Trophy } from "lucide-react";

interface GameSidebarProps {
  gameState: GameState;
  onNewGame: () => void;
  onOpenSettings: () => void;
  targetScore: number;
  matchTrack: MatchTrack;
  botSettings: BotSettings;
  onBotEnabledChange: (enabled: boolean) => void;
  onBotDifficultyChange: (difficulty: BotDifficulty) => void;
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
  legalAlternatives: string;
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
  "relative h-8 w-6 rounded-[0.5rem] border bg-gradient-to-br from-[#162820] via-[#0d1913] to-[#0a120e] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_12px_rgba(0,0,0,0.35)]";

const MATCH_PIP_STYLES = {
  bid: "bg-[#e85b5b] ring-1 ring-rose-200/60 shadow-[0_0_10px_rgba(232,91,91,0.45)]",
  set: "bg-[#0a0a0a] ring-1 ring-white/30 shadow-[inset_0_0_6px_rgba(255,255,255,0.15)]",
  empty: "bg-white/10 ring-1 ring-white/10",
} as const;

export function GameSidebar({
  gameState,
  onNewGame,
  onOpenSettings,
  targetScore,
  matchTrack,
  botSettings,
  onBotEnabledChange,
  onBotDifficultyChange,
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
  legalAlternatives,
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
    ? "Locked for this hand."
    : "Choose once; locks after the final deal.";
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
      : "Not declared";
  const royalsBadgeClass = isNoTrump
    ? "border-[#f2c879]/40 bg-[#f2c879]/10 text-[#f6d38b]"
    : royalsTeamId === "teamA"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
      : royalsTeamId === "teamB"
        ? "border-rose-400/40 bg-rose-500/10 text-emerald-100"
        : "border-white/10 bg-white/5 text-emerald-50";
  const teamAScore = matchTrack.teamA.length;
  const teamBScore = matchTrack.teamB.length;

  const renderMatchCards = (teamId: "teamA" | "teamB") => {
    const points = matchTrack[teamId];
    const teamBorder = teamId === "teamA" ? "border-emerald-400/25" : "border-rose-400/25";

    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label={`Match points for ${teamId}`}>
        {Array.from({ length: targetScore }, (_, index) => {
          const point = points[index];
          const pipTone = point?.kind ?? "empty";
          const pipClass =
            pipTone === "bid" ? MATCH_PIP_STYLES.bid : pipTone === "set" ? MATCH_PIP_STYLES.set : MATCH_PIP_STYLES.empty;
          const title = point ? (point.kind === "bid" ? "Made bid" : "Set opponents") : "Unscored point";

          return (
            <div key={`${teamId}-match-${index}`} title={title} className={cn(MATCH_CARD_BASE, teamBorder)}>
              <span className={cn("absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full", pipClass)} />
              <span className="pointer-events-none absolute inset-[3px] rounded-[0.4rem] border border-white/5" />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <aside className="hidden md:flex w-80 shrink-0 flex-col border-r border-white/10 bg-[#0c1813]">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-serif text-emerald-50">Solo Table</h1>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-100/60">Round {gameState.roundNumber}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onOpenSettings} className="text-emerald-100/70">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex-1 min-h-0">
        <TabsList className="mx-4 mt-3 grid grid-cols-3">
          <TabsTrigger value="overview" className="gap-2">
            <Trophy className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">AI</span>
          </TabsTrigger>
          <TabsTrigger value="log" className="gap-2">
            <ScrollText className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Log</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 min-h-0 px-4">
          <TabsContent value="overview" className="mt-3 space-y-2">
            <Card className="gap-2 py-3 bg-[#0a1712]/90 border border-emerald-500/20 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
              <CardHeader className="pb-0 gap-1">
                <CardTitle className="text-sm text-emerald-50">Control Mode</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <p className="text-[11px] text-emerald-100/70">{controlDescription}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["standard", "single-hand"] as const).map((mode) => (
                    <Button
                      key={mode}
                      size="sm"
                      onClick={() => onControlModeChange(mode)}
                      className={cn(
                        "h-9 rounded-full border px-4 text-[11px] uppercase tracking-[0.2em]",
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
                <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-100/50">{controlModeNote}</p>
              </CardContent>
            </Card>

            {(isBidding || isChoosingTrump) && (
              <Card className="gap-2 py-3 bg-[#08120e]/80 border border-emerald-400/20 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                <CardHeader className="pb-0 gap-1">
                  <CardTitle className="text-sm text-emerald-50">{isBidding ? "Bidding" : "Choose Trump"}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-1.5 text-xs text-emerald-100/70">
                  {isBidding && (
                    <p className="text-[11px] text-emerald-100/65">
                      Bidding is based on the first four cards. The winner names trump, picks Joker (no trump), or uses
                      the 7th card before the final deal.
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-100/70">Current bid</span>
                    <span className="text-emerald-50">
                      {gameState.currentBid ?? "--"}
                      {bidderName !== "--" && ` · ${bidderName}`}
                    </span>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-100/60">
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
                        <SelectTrigger className="h-8 min-w-[140px] rounded-full border-white/15 bg-white/5 text-[11px] text-emerald-50">
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
                        className="h-8 rounded-full bg-[#f2c879] px-4 text-[11px] font-semibold text-[#2b1c07] hover:bg-[#f8d690] disabled:opacity-50"
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
                        className="h-8 rounded-full border border-white/15 bg-white/5 px-4 text-[11px] text-emerald-50 hover:bg-white/10 disabled:opacity-50"
                      >
                        Pass
                      </Button>
                      {!canBid && <span className="text-[11px] text-emerald-100/60">Bots are bidding…</span>}
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
                            className="h-9 rounded-full border border-white/10 bg-white/5 text-emerald-50 hover:bg-white/10"
                          >
                            <span className="mr-2 text-base">{choice.symbol}</span>
                            {choice.label}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          onClick={() => onChooseTrump(null)}
                          className="col-span-2 h-9 rounded-full border border-[#f2c879]/40 bg-gradient-to-r from-[#1a1306]/80 via-[#2a1a06]/70 to-[#1a1306]/80 text-[#f6d38b] shadow-[inset_0_0_18px_rgba(242,200,121,0.2)] hover:bg-[#f2c879]/10"
                        >
                          <span className="mr-2 text-base">{JOKER_SYMBOL}</span>
                          Joker
                          <span className="ml-2 text-[10px] uppercase tracking-[0.28em] text-[#f6d38b]/70">
                            No trump
                          </span>
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        onClick={onChooseTrumpFromSeventh}
                        className="h-9 rounded-full border border-white/10 bg-white/5 text-emerald-50 hover:bg-white/10"
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
                <CardTitle className="text-sm text-emerald-50">Round Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5 text-sm text-emerald-100/70">
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
                  <span>Contract</span>
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
                  <span>Royals</span>
                  <Badge className={royalsBadgeClass}>{royalsStatus}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-2 py-3 bg-black/40 border-white/10">
              <CardHeader className="pb-0 gap-1">
                <CardTitle className="text-sm text-emerald-50">Key Rules</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-[11px] leading-relaxed text-emerald-100/70 space-y-1.5">
                <p>
                  • Bidding is based on the first four cards; the winner names trump, picks Joker, or uses the 7th card.
                </p>
                <p>• After trump is set, each player receives their final four cards.</p>
                <p>• Must follow suit if possible; trump stays hidden until a void player reveals it.</p>
                <p>• Joker means no trump suit (highest card of the led suit wins).</p>
                <p>• Last trick grants the 29th point; royals (K+Q of trump) adjust target ±4.</p>
              </CardContent>
            </Card>

            <Card className="gap-2 py-3 bg-black/40 border-white/10">
              <CardHeader className="pb-0 gap-1">
                <CardTitle className="text-sm text-emerald-50">Teams</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-200">{teamA.name}</span>
                    <span className="text-emerald-50">
                      {teamA.tricksWon} tricks · {teamA.handPoints} pts
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-emerald-100/60">
                    <span>Match</span>
                    <span className="text-emerald-50">
                      {teamAScore} / {targetScore}
                    </span>
                  </div>
                  {renderMatchCards("teamA")}
                </div>
                <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-rose-200">{teamB.name}</span>
                    <span className="text-emerald-50">
                      {teamB.tricksWon} tricks · {teamB.handPoints} pts
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-emerald-100/60">
                    <span>Match</span>
                    <span className="text-emerald-50">
                      {teamBScore} / {targetScore}
                    </span>
                  </div>
                  {renderMatchCards("teamB")}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-emerald-100/50">
                  <span className="inline-flex items-center gap-1">
                    <span className={cn("size-1.5 rounded-full", MATCH_PIP_STYLES.bid)} />
                    made bid
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className={cn("size-1.5 rounded-full", MATCH_PIP_STYLES.set)} />
                    set opponents
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="mt-3 space-y-2">
            <Card className="gap-2 py-3 bg-black/40 border-white/10">
              <CardHeader className="pb-1 gap-1">
                <CardTitle className="text-sm flex items-center gap-2 text-emerald-50">
                  <Sparkles className="h-4 w-4 text-[#f2c879]" />
                  LLM Bots
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-emerald-50">Enable LLM strategy</p>
                    <p className="text-xs text-emerald-100/60">Let bots consult OpenRouter on every move.</p>
                  </div>
                  <Switch checked={botSettings.enabled} onCheckedChange={onBotEnabledChange} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-emerald-100/60">Difficulty</p>
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
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs text-emerald-100/60 space-y-1">
                  <p>Model: {botSettings.model}</p>
                  <p>Fallbacks: {botSettings.fallbackModels.join(", ")}</p>
                  <p>Temperature: {botSettings.temperature}</p>
                  <p>{botSettings.usageHint}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-2 py-3 bg-black/40 border-white/10">
              <CardHeader className="pb-1 gap-1">
                <CardTitle className="text-sm text-emerald-50">AI Coach</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-emerald-50">Explain last move</p>
                    <p className="text-xs text-emerald-100/60">Get a quick critique and alternatives.</p>
                  </div>
                  <Switch checked={coachEnabled} onCheckedChange={onCoachEnabledChange} />
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs text-emerald-100/60 space-y-1">
                  <p>
                    <span className="font-medium text-emerald-50">Last move:</span> {lastMoveSummary}
                  </p>
                  <p>
                    <span className="font-medium text-emerald-50">Legal alternatives:</span> {legalAlternatives}
                  </p>
                </div>
                <Button onClick={onRequestCoach} disabled={!canRequestCoach} className="w-full">
                  {coachLoading ? "Analyzing..." : "Explain last move"}
                </Button>
                {coachError && <p className="text-xs text-rose-300">{coachError}</p>}
                {coachResponse && (
                  <div className="rounded-lg border border-white/10 bg-white/90 p-2.5 text-xs text-slate-900 leading-relaxed whitespace-pre-wrap">
                    {coachResponse}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="log" className="mt-3 space-y-2">
            <Card className="gap-2 py-3 bg-black/40 border-white/10">
              <CardHeader className="pb-1 gap-1">
                <CardTitle className="text-sm text-emerald-50">Trick Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs text-emerald-100/70">
                  {gameState.log.length === 0 ? (
                    <p>No actions yet.</p>
                  ) : (
                    gameState.log.slice(-10).map((entry, index) => <p key={index}>• {entry}</p>)
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <div className="p-4 border-t border-white/10 space-y-2">
        <Button onClick={onNewGame} className="w-full gap-2 bg-[#f2c879] text-[#2b1c07] hover:bg-[#f8d690]">
          <RotateCcw className="h-4 w-4" />
          New Game
        </Button>
      </div>
    </aside>
  );
}

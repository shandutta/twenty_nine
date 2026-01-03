"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GameState, Suit } from "@/components/game/types";
import type { BotDifficulty, BotSettings } from "@/components/game/use-game-controller";
import { Settings, RotateCcw, Sparkles, ScrollText, Trophy } from "lucide-react";

interface GameSidebarProps {
  gameState: GameState;
  onNewGame: () => void;
  onOpenSettings: () => void;
  botSettings: BotSettings;
  onBotEnabledChange: (enabled: boolean) => void;
  onBotDifficultyChange: (difficulty: BotDifficulty) => void;
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
  onChooseTrump: (suit: Suit) => void;
}

const suitSymbols: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

export function GameSidebar({
  gameState,
  onNewGame,
  onOpenSettings,
  botSettings,
  onBotEnabledChange,
  onBotDifficultyChange,
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
}: GameSidebarProps) {
  const teamA = gameState.teams.teamA;
  const teamB = gameState.teams.teamB;
  const bidderName = gameState.bidWinner
    ? (gameState.players.find((player) => player.id === gameState.bidWinner)?.name ?? "-")
    : "--";
  const bidderTeamId = gameState.bidWinner ? (teamA.players.includes(gameState.bidWinner) ? "teamA" : "teamB") : null;
  const trumpLabel = gameState.trumpSuit
    ? gameState.trumpRevealed
      ? suitSymbols[gameState.trumpSuit]
      : "Hidden"
    : "Pending";
  const currentPlayer = gameState.players.find((player) => player.id === gameState.currentPlayerId)?.name ?? "-";
  const phaseLabel = gameState.phase.replace("-", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const isBidding = gameState.phase === "bidding";
  const isChoosingTrump = gameState.phase === "choose-trump";
  const royalsTeamId = gameState.royalsDeclaredBy;
  const royalsTeam = royalsTeamId ? (royalsTeamId === "teamA" ? teamA : teamB) : null;
  const royalsDirection = royalsTeamId && bidderTeamId ? (royalsTeamId === bidderTeamId ? "-" : "+") : "+/-";
  const royalsStatus = royalsTeamId
    ? `${royalsTeam?.name ?? "Team"} ${royalsDirection}${gameState.royalsAdjustment}`
    : "Not declared";
  const royalsBadgeClass =
    royalsTeamId === "teamA"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
      : royalsTeamId === "teamB"
        ? "border-rose-400/40 bg-rose-500/10 text-emerald-100"
        : "border-white/10 bg-white/5 text-emerald-50";

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
        <TabsList className="mx-4 mt-4 grid grid-cols-3">
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
          <TabsContent value="overview" className="mt-4 space-y-3">
            {(isBidding || isChoosingTrump) && (
              <Card className="gap-3 py-4 bg-[#08120e]/80 border border-emerald-400/20 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm text-emerald-50">{isBidding ? "Bidding" : "Choose Trump"}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2 text-xs text-emerald-100/70">
                  {isBidding && (
                    <p className="text-[11px] text-emerald-100/65">
                      Bidding uses the first four cards. The winner sets trump, then the remaining cards are dealt.
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
                        ? "Pick the trump suit"
                        : `Waiting for ${currentPlayer}`}
                  </div>
                  {isBidding && canBid && bidOptions.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {bidOptions.map((bid) => (
                        <Button
                          key={bid}
                          size="sm"
                          onClick={() => onPlaceBid(bid)}
                          className="h-8 rounded-full bg-[#f2c879] text-[11px] font-semibold text-[#2b1c07] hover:bg-[#f8d690]"
                        >
                          Bid {bid}
                        </Button>
                      ))}
                    </div>
                  )}
                  {isBidding && (
                    <div className="flex items-center justify-between gap-3 pt-1">
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
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {(["clubs", "diamonds", "hearts", "spades"] as const).map((suit) => (
                        <Button
                          key={suit}
                          size="sm"
                          onClick={() => onChooseTrump(suit)}
                          className="h-9 rounded-full border border-white/10 bg-white/5 text-emerald-50 hover:bg-white/10"
                        >
                          <span className="mr-2 text-base">{suitSymbols[suit]}</span>
                          {suit[0].toUpperCase() + suit.slice(1)}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="gap-3 py-4 bg-black/40 border-white/10">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-emerald-50">Round Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm text-emerald-100/70">
                <div className="flex items-center justify-between">
                  <span>Phase</span>
                  <Badge className="border-white/10 bg-white/5 text-emerald-50">{phaseLabel}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Current Player</span>
                  <span className="text-emerald-50">{currentPlayer}</span>
                </div>
                <Separator className="bg-white/10 my-2" />
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

            <Card className="gap-3 py-4 bg-black/40 border-white/10">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-emerald-50">Key Rules</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-[11px] leading-relaxed text-emerald-100/70 space-y-2">
                <p>• Bidding uses the first 4 cards; the winner chooses trump.</p>
                <p>• The remaining 4 cards are dealt after trump is set.</p>
                <p>• Must follow suit if possible; trump reveals when a player can’t follow suit.</p>
                <p>• Last trick grants the 29th point; royals (K+Q of trump) adjust target ±4.</p>
              </CardContent>
            </Card>

            <Card className="gap-3 py-4 bg-black/40 border-white/10">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-emerald-50">Teams</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3 text-sm">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-200">{teamA.name}</span>
                    <span className="text-emerald-50">
                      {teamA.tricksWon} tricks · {teamA.handPoints} pts
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-rose-200">{teamB.name}</span>
                    <span className="text-emerald-50">
                      {teamB.tricksWon} tricks · {teamB.handPoints} pts
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="mt-4 space-y-4">
            <Card className="bg-black/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-emerald-50">
                  <Sparkles className="h-4 w-4 text-[#f2c879]" />
                  LLM Bots
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-emerald-50">Enable LLM strategy</p>
                    <p className="text-xs text-emerald-100/60">Let bots consult OpenRouter on every move.</p>
                  </div>
                  <Switch checked={botSettings.enabled} onCheckedChange={onBotEnabledChange} />
                </div>
                <div className="space-y-2">
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
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-emerald-100/60 space-y-1">
                  <p>Model: {botSettings.model}</p>
                  <p>Fallbacks: {botSettings.fallbackModels.join(", ")}</p>
                  <p>Temperature: {botSettings.temperature}</p>
                  <p>{botSettings.usageHint}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-emerald-50">AI Coach</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-emerald-50">Explain last move</p>
                    <p className="text-xs text-emerald-100/60">Get a quick critique and alternatives.</p>
                  </div>
                  <Switch checked={coachEnabled} onCheckedChange={onCoachEnabledChange} />
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-emerald-100/60 space-y-1">
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
                  <div className="rounded-lg border border-white/10 bg-white/90 p-3 text-xs text-slate-900 leading-relaxed whitespace-pre-wrap">
                    {coachResponse}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="log" className="mt-4 space-y-4">
            <Card className="bg-black/40 border-white/10">
              <CardHeader className="pb-2">
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

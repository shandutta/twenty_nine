"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { GameState } from "@/components/game/types"
import type { BotDifficulty, BotSettings } from "@/components/game/use-game-controller"
import { Settings, RotateCcw, Trophy, Users, Info, Sparkles } from "lucide-react"

interface GameSidebarProps {
  gameState: GameState
  onNewGame: () => void
  onOpenSettings: () => void
  botSettings: BotSettings
  onBotEnabledChange: (enabled: boolean) => void
  onBotDifficultyChange: (difficulty: BotDifficulty) => void
  coachEnabled: boolean
  onCoachEnabledChange: (enabled: boolean) => void
  coachLoading: boolean
  coachError: string | null
  coachResponse: string | null
  onRequestCoach: () => void
  lastMoveSummary: string
  legalAlternatives: string
  canRequestCoach: boolean
}

function ScoringDisplay({ score, label }: { score: number; label: string }) {
  const absScore = Math.abs(score)
  const isWinning = score > 0

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {absScore === 0 ? (
          <span className="text-sm text-muted-foreground">-</span>
        ) : (
          Array.from({ length: absScore }).map((_, i) => (
            <div
              key={i}
              className={`h-8 w-6 rounded border flex items-center justify-center text-xs font-bold ${
                isWinning ? "bg-white border-red-400 text-red-600" : "bg-white border-neutral-400 text-neutral-900"
              }`}
            >
              <div className="flex flex-col items-center leading-none">
                <span className="text-[8px]">6</span>
                <span className={isWinning ? "text-red-600" : "text-neutral-900"}>{isWinning ? "♥" : "♠"}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

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
}: GameSidebarProps) {
  const teamA = gameState.teams.teamA
  const teamB = gameState.teams.teamB

  const teamAPlayers = gameState.players.filter((p) => p.teamId === "teamA")
  const teamBPlayers = gameState.players.filter((p) => p.teamId === "teamB")

  return (
    <aside className="hidden lg:flex w-80 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">29</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">Twenty-Nine</h1>
              <p className="text-xs text-muted-foreground">Round {gameState.roundNumber}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onOpenSettings}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Tabs Content */}
      <Tabs defaultValue="score" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4 grid grid-cols-4">
          <TabsTrigger value="score" className="gap-1">
            <Trophy className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Score</span>
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-1">
            <Users className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Teams</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1">
            <Info className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Rules</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1">
            <Sparkles className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">AI</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4">
          <TabsContent value="score" className="mt-4 space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Game Score (6 Cards)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <ScoringDisplay score={teamA.gameScore} label={teamA.name} />
                  <ScoringDisplay score={teamB.gameScore} label={teamB.name} />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Red 6s = winning bids, Black 6s = losing bids
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Current Round</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {teamA.bid && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Bid:</span>
                      <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/40">
                        {teamA.bid}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Bid Winner:</span>
                      <span>{gameState.players.find((p) => p.id === teamA.bidWinner)?.name}</span>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{teamA.name} Tricks:</span>
                  <span className="text-emerald-400 font-medium">{teamA.tricksWon}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{teamB.name} Tricks:</span>
                  <span className="text-rose-400 font-medium">{teamB.tricksWon}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{teamA.name} Points:</span>
                  <span className="text-emerald-400 font-medium">{teamA.handPoints}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{teamB.name} Points:</span>
                  <span className="text-rose-400 font-medium">{teamB.handPoints}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams" className="mt-4 space-y-4">
            <Card className="bg-card border-emerald-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  {teamA.name}
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  >
                    Your Team
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {teamAPlayers.map((player) => (
                  <div key={player.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-sm font-medium text-emerald-400">
                        {player.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{player.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{player.position}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Team Tricks:</span>
                    <span className="font-medium text-emerald-400">{teamA.tricksWon}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-rose-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  {teamB.name}
                  <Badge variant="outline" className="text-[10px] bg-rose-500/20 text-rose-400 border-rose-500/40">
                    Opponents
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {teamBPlayers.map((player) => (
                  <div key={player.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-sm font-medium text-rose-400">
                        {player.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{player.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{player.position}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Team Tricks:</span>
                    <span className="font-medium text-rose-400">{teamB.tricksWon}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules" className="mt-4 space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Hand State</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between text-sm">
                  <span>Phase</span>
                  <span className="font-medium text-foreground">{gameState.phase}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Trick</span>
                  <span className="font-medium text-foreground">
                    {Math.min(gameState.trickNumber + 1, 8)} / 8
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Current Player</span>
                  <span className="font-medium text-foreground">
                    {gameState.players.find((p) => p.id === gameState.currentPlayerId)?.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Trump</span>
                  <span className="font-medium text-foreground">
                    {gameState.trumpRevealed ? gameState.trumpSuit : "Hidden"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Card Points</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Jack (J)</span>
                    <Badge variant="outline">3 pts</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Nine (9)</span>
                    <Badge variant="outline">2 pts</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Ace (A)</span>
                    <Badge variant="outline">1 pt</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Ten (10)</span>
                    <Badge variant="outline">1 pt</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">K, Q, 8, 7 = 0 points</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Quick Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>• Total 28 points in deck + last trick bonus = 29</p>
                <p>• Partners sit across from each other</p>
                <p>• Minimum bid is 16, maximum is 29</p>
                <p>• Royals (K+Q of trump) adjust bid by ±4 within bounds</p>
                <p>• Trump reveals when someone cannot follow suit</p>
                <p>• Must follow suit if possible</p>
                <p>• Highest card of led suit wins (unless trumped)</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Action Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs text-muted-foreground">
                  {gameState.log.length === 0 ? (
                    <p>No actions yet.</p>
                  ) : (
                    gameState.log.slice(-8).map((entry, index) => <p key={index}>• {entry}</p>)
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Scoring with 6 Cards</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>• Each team starts with 6 cards (three red ♥, three black ♠)</p>
                <p>• Win bid = opponent gives you a red 6</p>
                <p>• Lose bid = you give opponent a black 6</p>
                <p>• Game ends when one team has all 6 cards</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="mt-4 space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                  LLM Bots
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Enable LLM strategy</p>
                    <p className="text-xs text-muted-foreground">Let bots consult OpenRouter on tricky turns.</p>
                  </div>
                  <Switch checked={botSettings.enabled} onCheckedChange={onBotEnabledChange} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Difficulty</p>
                  <Select value={botSettings.difficulty} onValueChange={(value) => onBotDifficultyChange(value as BotDifficulty)}>
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
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                  <p>Model: {botSettings.model}</p>
                  <p>Temperature: {botSettings.temperature}</p>
                  <p>{botSettings.usageHint}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">AI Coach</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Explain last move</p>
                    <p className="text-xs text-muted-foreground">Get a quick critique and alternatives.</p>
                  </div>
                  <Switch checked={coachEnabled} onCheckedChange={onCoachEnabledChange} />
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium text-foreground">Last move:</span> {lastMoveSummary}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Legal alternatives:</span> {legalAlternatives}
                  </p>
                </div>
                <Button onClick={onRequestCoach} disabled={!canRequestCoach} className="w-full">
                  {coachLoading ? "Analyzing..." : "Explain last move"}
                </Button>
                {coachError && <p className="text-xs text-red-500">{coachError}</p>}
                {coachResponse && (
                  <div className="rounded-lg border border-border bg-white/80 p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {coachResponse}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Footer Actions */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <Button onClick={onNewGame} className="w-full gap-2">
          <RotateCcw className="h-4 w-4" />
          New Round
        </Button>
      </div>
    </aside>
  )
}

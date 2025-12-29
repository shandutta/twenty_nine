"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Hand } from "./hand"
import type { GameState, PlayingCard, Player, Suit } from "@/app/game/page"
import { Eye } from "lucide-react"

interface GameTableProps {
  gameState: GameState
  onPlayCard: (card: PlayingCard) => void
  onRevealTrump: () => void
  animationsEnabled: boolean
}

const suitSymbols: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
}

function getSuitColor(suit: Suit) {
  return suit === "hearts" || suit === "diamonds" ? "text-red-600" : "text-gray-900"
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
  }
  return positions[rank] || []
}

function isFaceCard(rank: string) {
  return ["J", "Q", "K"].includes(rank)
}

function PlayedCard({ card }: { card: PlayingCard }) {
  const suitColor = getSuitColor(card.suit)
  const suitColorBg = card.suit === "hearts" || card.suit === "diamonds" ? "bg-red-50" : "bg-gray-50"
  const suitColorBorder = card.suit === "hearts" || card.suit === "diamonds" ? "border-red-300" : "border-gray-300"
  const pips = getPipPositions(card.rank)
  const isFace = isFaceCard(card.rank)
  const isAce = card.rank === "A"

  return (
    <div className="relative h-[100px] w-[70px] md:h-[120px] md:w-[84px] rounded-lg bg-white shadow-xl border border-gray-300 overflow-hidden">
      {/* Top-left corner index */}
      <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
        <span className={cn("text-[10px] md:text-xs font-bold", suitColor)}>{card.rank}</span>
        <span className={cn("text-[10px] md:text-xs -mt-0.5", suitColor)}>{suitSymbols[card.suit]}</span>
      </div>

      {/* Bottom-right corner index (inverted) */}
      <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
        <span className={cn("text-[10px] md:text-xs font-bold", suitColor)}>{card.rank}</span>
        <span className={cn("text-[10px] md:text-xs -mt-0.5", suitColor)}>{suitSymbols[card.suit]}</span>
      </div>

      {/* Card center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[40px] h-[65px] md:w-[48px] md:h-[80px]">
          {isAce ? (
            <div className="h-full flex items-center justify-center">
              <span className={cn("text-3xl md:text-4xl", suitColor)}>{suitSymbols[card.suit]}</span>
            </div>
          ) : isFace ? (
            <div
              className={cn(
                "h-full w-full rounded border-2 flex flex-col items-center justify-center gap-0.5",
                suitColorBorder,
                suitColorBg,
              )}
            >
              <span className={cn("text-lg md:text-xl font-bold", suitColor)}>{card.rank}</span>
              <span className={cn("text-base md:text-lg", suitColor)}>{suitSymbols[card.suit]}</span>
            </div>
          ) : (
            <div className="relative h-full w-full">
              {pips.map((pos, i) => (
                <span
                  key={i}
                  className={cn(
                    "absolute text-xs md:text-sm transform -translate-x-1/2 -translate-y-1/2",
                    suitColor,
                    pos.inverted && "rotate-180",
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
  )
}

function CardBack({ size = "small" }: { size?: "small" | "medium" }) {
  const sizeClasses = size === "small" ? "h-14 w-10 md:h-16 md:w-11" : "h-16 w-11 md:h-20 md:w-14"

  return (
    <div className={cn(sizeClasses, "rounded-md bg-stone-200 shadow-md border border-stone-300 overflow-hidden")}>
      <div className="w-full h-full p-1">
        <div
          className="w-full h-full rounded-sm border border-stone-400 bg-stone-100"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 4px,
                rgba(120,113,108,0.2) 4px,
                rgba(120,113,108,0.2) 5px
              ),
              repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 4px,
                rgba(120,113,108,0.2) 4px,
                rgba(120,113,108,0.2) 5px
              )
            `,
          }}
        />
      </div>
    </div>
  )
}

function ScoringCard({ isRed, pipsShown }: { isRed: boolean; pipsShown: number }) {
  // Standard 6 card pip positions (two columns of 3)
  const allPipPositions = [
    { x: 30, y: 20 },
    { x: 70, y: 20 },
    { x: 30, y: 50 },
    { x: 70, y: 50 },
    { x: 30, y: 80 },
    { x: 70, y: 80 },
  ]

  const suit = isRed ? "♦" : "♠"
  const colorClass = isRed ? "text-red-600" : "text-gray-900"

  return (
    <div className="relative h-16 w-11 md:h-20 md:w-14 rounded bg-white shadow border border-gray-300 overflow-hidden">
      {/* Corner index */}
      <div className="absolute top-0.5 left-1 flex flex-col items-center leading-none">
        <span className={cn("text-[9px] md:text-[10px] font-bold", colorClass)}>6</span>
        <span className={cn("text-[9px] md:text-[10px] -mt-0.5", colorClass)}>{suit}</span>
      </div>

      {/* Bottom corner (inverted) */}
      <div className="absolute bottom-0.5 right-1 flex flex-col items-center leading-none rotate-180">
        <span className={cn("text-[9px] md:text-[10px] font-bold", colorClass)}>6</span>
        <span className={cn("text-[9px] md:text-[10px] -mt-0.5", colorClass)}>{suit}</span>
      </div>

      {/* Pips - show only the number indicated */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[30px] h-[45px] md:w-[36px] md:h-[55px]">
          {allPipPositions.slice(0, pipsShown).map((pos, i) => (
            <span
              key={i}
              className={cn("absolute text-[10px] md:text-xs transform -translate-x-1/2 -translate-y-1/2", colorClass)}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              {suit}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function TeamScoring({ score, teamName, isUserTeam }: { score: number; teamName: string; isUserTeam: boolean }) {
  const absScore = Math.abs(score)
  const isWinning = score >= 0

  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-xs font-medium", isUserTeam ? "text-emerald-400" : "text-amber-200")}>{teamName}</span>
      <ScoringCard isRed={isWinning} pipsShown={absScore} />
    </div>
  )
}

function OpponentArea({
  player,
  position,
  isTeammate,
}: {
  player: Player
  position: "top" | "left" | "right"
  isTeammate: boolean
}) {
  const cardCount = player.cards.length

  if (position === "top") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", isTeammate ? "text-emerald-400" : "text-amber-200")}>
            {player.name}
          </span>
          {isTeammate && (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
              Partner
            </Badge>
          )}
        </div>
        <div className="flex -space-x-5">
          {Array.from({ length: cardCount }).map((_, i) => (
            <CardBack key={i} size="medium" />
          ))}
        </div>
      </div>
    )
  }

  // Left and right players - horizontal overlapping cards
  return (
    <div className="flex flex-col items-center gap-2">
      <span className={cn("text-sm font-medium", isTeammate ? "text-emerald-400" : "text-amber-200")}>
        {player.name}
      </span>
      <div className="flex -space-x-6">
        {Array.from({ length: cardCount }).map((_, i) => (
          <CardBack key={i} size="small" />
        ))}
      </div>
    </div>
  )
}

export function GameTable({ gameState, onPlayCard, onRevealTrump, animationsEnabled }: GameTableProps) {
  const bottomPlayer = gameState.players.find((p) => p.position === "bottom")!
  const leftPlayer = gameState.players.find((p) => p.position === "left")!
  const topPlayer = gameState.players.find((p) => p.position === "top")!
  const rightPlayer = gameState.players.find((p) => p.position === "right")!

  const getPlayedCard = (playerId: string) => gameState.currentTrick.find((t) => t.playerId === playerId)?.card

  const teamA = gameState.teams.teamA
  const teamB = gameState.teams.teamB

  return (
    <TooltipProvider>
      <div className="relative h-full w-full p-4 md:p-8">
        <div
          className="absolute inset-4 md:inset-8 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: `
              linear-gradient(180deg,
                rgb(101, 67, 33) 0%,
                rgb(139, 90, 43) 20%,
                rgb(160, 120, 60) 40%,
                rgb(139, 90, 43) 60%,
                rgb(120, 80, 40) 80%,
                rgb(101, 67, 33) 100%
              )
            `,
            boxShadow: "inset 0 0 80px rgba(0,0,0,0.5), 0 10px 40px rgba(0,0,0,0.4)",
          }}
        >
          {/* Wood grain texture */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                repeating-linear-gradient(
                  0deg,
                  transparent 0px,
                  transparent 30px,
                  rgba(60,40,20,0.15) 30px,
                  rgba(60,40,20,0.15) 32px,
                  transparent 32px,
                  transparent 80px,
                  rgba(60,40,20,0.1) 80px,
                  rgba(60,40,20,0.1) 81px
                )
              `,
            }}
          />
          {/* Subtle knot patterns */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                radial-gradient(ellipse 20px 30px at 20% 30%, rgba(60,40,20,0.3), transparent),
                radial-gradient(ellipse 15px 25px at 80% 70%, rgba(60,40,20,0.25), transparent),
                radial-gradient(ellipse 25px 20px at 60% 20%, rgba(60,40,20,0.2), transparent)
              `,
            }}
          />
        </div>

        {/* Table Content */}
        <div className="relative h-full flex flex-col px-4 md:px-6">
          <div className="flex items-center justify-between py-3 md:py-4 px-2">
            {/* Trump indicator */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/95 backdrop-blur border border-border shadow-lg">
              <span className="text-xs text-muted-foreground">Trump:</span>
              {gameState.trumpRevealed && gameState.trumpSuit ? (
                <span className={cn("text-xl", getSuitColor(gameState.trumpSuit))}>
                  {suitSymbols[gameState.trumpSuit]}
                </span>
              ) : (
                <span className="text-lg font-bold text-muted-foreground">?</span>
              )}
              {!gameState.trumpRevealed && gameState.bidWinner === "player1" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={onRevealTrump} className="gap-1 h-7 px-2">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reveal trump suit</TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Center: Bid and tricks */}
            <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-background/95 backdrop-blur border border-border shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Bid:</span>
                <span className="text-lg font-bold text-amber-400">{teamA.bid || "-"}</span>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-[10px] text-emerald-400">Your Team</div>
                  <div className="text-sm font-bold text-emerald-400">{teamA.tricksWon}</div>
                </div>
                <span className="text-muted-foreground text-sm">tricks</span>
                <div className="text-center">
                  <div className="text-[10px] text-rose-400">Opponents</div>
                  <div className="text-sm font-bold text-rose-400">{teamB.tricksWon}</div>
                </div>
              </div>
            </div>

            {/* Scoring cards */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background/95 backdrop-blur border border-border shadow-lg">
              <TeamScoring score={teamA.gameScore} teamName="You" isUserTeam={true} />
              <div className="w-px h-12 bg-border" />
              <TeamScoring score={teamB.gameScore} teamName="Opp" isUserTeam={false} />
            </div>
          </div>

          {/* Top Player (Partner) */}
          <div className="flex justify-center pt-2 md:pt-4">
            <OpponentArea player={topPlayer} position="top" isTeammate={true} />
          </div>

          {/* Middle Row */}
          <div className="flex-1 flex items-center justify-between px-12 md:px-24">
            {/* Left Player (Opponent) */}
            <div className="flex-shrink-0">
              <OpponentArea player={leftPlayer} position="left" isTeammate={false} />
            </div>

            {/* Center play area - 4 card positions */}
            <div className="flex-1 flex items-center justify-center">
              <div className="relative w-64 h-48 md:w-72 md:h-56">
                {/* Top card (North/Partner) */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2">
                  {getPlayedCard(topPlayer.id) ? (
                    <div className={cn(animationsEnabled && "animate-in fade-in slide-in-from-top-4 duration-300")}>
                      <PlayedCard card={getPlayedCard(topPlayer.id)!} />
                    </div>
                  ) : (
                    <div className="h-[100px] w-[70px] md:h-[120px] md:w-[84px] rounded-lg border-2 border-dashed border-white/20" />
                  )}
                </div>

                {/* Left card (West) */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                  {getPlayedCard(leftPlayer.id) ? (
                    <div className={cn(animationsEnabled && "animate-in fade-in slide-in-from-left-4 duration-300")}>
                      <PlayedCard card={getPlayedCard(leftPlayer.id)!} />
                    </div>
                  ) : (
                    <div className="h-[100px] w-[70px] md:h-[120px] md:w-[84px] rounded-lg border-2 border-dashed border-white/20" />
                  )}
                </div>

                {/* Right card (East) */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                  {getPlayedCard(rightPlayer.id) ? (
                    <div className={cn(animationsEnabled && "animate-in fade-in slide-in-from-right-4 duration-300")}>
                      <PlayedCard card={getPlayedCard(rightPlayer.id)!} />
                    </div>
                  ) : (
                    <div className="h-[100px] w-[70px] md:h-[120px] md:w-[84px] rounded-lg border-2 border-dashed border-white/20" />
                  )}
                </div>

                {/* Bottom card (You) */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
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

            {/* Right Player (Opponent) */}
            <div className="flex-shrink-0">
              <OpponentArea player={rightPlayer} position="right" isTeammate={false} />
            </div>
          </div>

          {/* Bottom Player - Your Hand */}
          <div className="pb-4 md:pb-6">
            <Hand
              player={bottomPlayer}
              onPlayCard={onPlayCard}
              isCurrentTurn={bottomPlayer.isCurrentPlayer}
              animationsEnabled={animationsEnabled}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

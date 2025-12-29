"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Player, PlayingCard, Suit } from "@/components/game/types"

interface HandProps {
  player: Player
  onPlayCard: (card: PlayingCard) => void
  isCurrentTurn: boolean
  legalCardIds: string[]
  animationsEnabled: boolean
}

const suitSymbols: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
}

function getSuitColor(suit: Suit) {
  return suit === "hearts" || suit === "diamonds" ? "text-red-600" : "text-gray-900"
}

const cardValues: Record<string, number> = {
  J: 3,
  "9": 2,
  A: 1,
  "10": 1,
  K: 0,
  Q: 0,
  "8": 0,
  "7": 0,
}

function getPipPositions(rank: string): { x: number; y: number; inverted?: boolean }[] {
  const positions: Record<string, { x: number; y: number; inverted?: boolean }[]> = {
    // Ace: single large center pip (handled separately)
    A: [],
    // 2: one top center, one bottom center (inverted)
    "2": [
      { x: 50, y: 20 },
      { x: 50, y: 80, inverted: true },
    ],
    // 3: one top, one middle, one bottom (inverted)
    "3": [
      { x: 50, y: 20 },
      { x: 50, y: 50 },
      { x: 50, y: 80, inverted: true },
    ],
    // 4: four corners
    "4": [
      { x: 30, y: 20 },
      { x: 70, y: 20 },
      { x: 30, y: 80, inverted: true },
      { x: 70, y: 80, inverted: true },
    ],
    // 5: four corners + center
    "5": [
      { x: 30, y: 20 },
      { x: 70, y: 20 },
      { x: 50, y: 50 },
      { x: 30, y: 80, inverted: true },
      { x: 70, y: 80, inverted: true },
    ],
    // 6: two columns of 3
    "6": [
      { x: 30, y: 20 },
      { x: 70, y: 20 },
      { x: 30, y: 50 },
      { x: 70, y: 50 },
      { x: 30, y: 80, inverted: true },
      { x: 70, y: 80, inverted: true },
    ],
    // 7: two columns of 3 + one center-top
    "7": [
      { x: 30, y: 20 },
      { x: 70, y: 20 },
      { x: 50, y: 35 },
      { x: 30, y: 50 },
      { x: 70, y: 50 },
      { x: 30, y: 80, inverted: true },
      { x: 70, y: 80, inverted: true },
    ],
    // 8: two columns of 3 + two center
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
    // 9: two columns of 4 + one center
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
    // 10: two columns of 4 + two center (one top-center, one bottom-center)
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
    // Face cards handled separately
    J: [],
    Q: [],
    K: [],
  }
  return positions[rank] || []
}

function isFaceCard(rank: string) {
  return ["J", "Q", "K"].includes(rank)
}

function PlayableCard({
  card,
  onClick,
  isPlayable,
  index,
  total,
}: {
  card: PlayingCard
  onClick: () => void
  isPlayable: boolean
  index: number
  total: number
  animationsEnabled: boolean
}) {
  const [isHovered, setIsHovered] = useState(false)
  const suitColor = getSuitColor(card.suit)
  const suitColorBg = card.suit === "hearts" || card.suit === "diamonds" ? "bg-red-50" : "bg-gray-50"
  const suitColorBorder = card.suit === "hearts" || card.suit === "diamonds" ? "border-red-300" : "border-gray-300"
  const pips = getPipPositions(card.rank)
  const isFace = isFaceCard(card.rank)
  const isAce = card.rank === "A"

  // Calculate fan positioning
  const centerOffset = (total - 1) / 2
  const rotation = (index - centerOffset) * 3
  const yOffset = Math.abs(index - centerOffset) * 2

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={!isPlayable}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          className={cn(
            "relative rounded-lg bg-white shadow-lg border transition-all duration-200 overflow-hidden",
            "h-[120px] w-[84px] md:h-[150px] md:w-[105px]",
            isPlayable
                ? "border-amber-400 ring-2 ring-amber-400/40 hover:shadow-2xl cursor-pointer"
                : "border-gray-300 opacity-60 cursor-not-allowed",
          )}
            style={{
              transform: `rotate(${isHovered && isPlayable ? 0 : rotation}deg) translateY(${isHovered && isPlayable ? -20 : yOffset}px)`,
              marginLeft: index === 0 ? 0 : "-1.25rem",
              zIndex: isHovered ? 50 : index,
            }}
          >
            {/* Top left corner index */}
            <div className="absolute top-1.5 left-2 flex flex-col items-center leading-none">
              <span className={cn("text-sm md:text-base font-bold", suitColor)}>{card.rank}</span>
              <span className={cn("text-sm md:text-base -mt-0.5", suitColor)}>{suitSymbols[card.suit]}</span>
            </div>

            {/* Bottom right corner index (inverted) */}
            <div className="absolute bottom-1.5 right-2 flex flex-col items-center leading-none rotate-180">
              <span className={cn("text-sm md:text-base font-bold", suitColor)}>{card.rank}</span>
              <span className={cn("text-sm md:text-base -mt-0.5", suitColor)}>{suitSymbols[card.suit]}</span>
            </div>

            {/* Card center content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[50px] h-[80px] md:w-[60px] md:h-[100px]">
                {isAce ? (
                  // Ace: single large suit symbol
                  <div className="h-full flex items-center justify-center">
                    <span className={cn("text-5xl md:text-6xl", suitColor)}>{suitSymbols[card.suit]}</span>
                  </div>
                ) : isFace ? (
                  // Face cards: bordered rectangle with letter and suit
                  <div
                    className={cn(
                      "h-full w-full rounded border-2 flex flex-col items-center justify-center gap-1",
                      suitColorBorder,
                      suitColorBg,
                    )}
                  >
                    <span className={cn("text-2xl md:text-3xl font-bold", suitColor)}>{card.rank}</span>
                    <span className={cn("text-xl md:text-2xl", suitColor)}>{suitSymbols[card.suit]}</span>
                  </div>
                ) : (
                  // Number cards: pip pattern
                  <div className="relative h-full w-full">
                    {pips.map((pos, i) => (
                      <span
                        key={i}
                        className={cn(
                          "absolute text-base md:text-lg transform -translate-x-1/2 -translate-y-1/2",
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

            {/* Point value indicator */}
            {cardValues[card.rank] > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full bg-amber-500 text-[10px] md:text-xs font-bold flex items-center justify-center text-white shadow">
                {cardValues[card.rank]}
              </div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>
            {card.rank} of {card.suit} ({cardValues[card.rank]} pts)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function Hand({ player, onPlayCard, isCurrentTurn, legalCardIds, animationsEnabled }: HandProps) {
  // Sort cards by suit then by value
  const suitOrder: Suit[] = ["spades", "hearts", "clubs", "diamonds"]
  const rankOrder = ["J", "9", "A", "10", "K", "Q", "8", "7"]

  const sortedCards = [...player.cards].sort((a, b) => {
    const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit)
    if (suitDiff !== 0) return suitDiff
    return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank)
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex justify-center items-end px-12 md:px-16 py-2">
        {sortedCards.map((card, index) => (
          <PlayableCard
            key={card.id}
            card={card}
            onClick={() => onPlayCard(card)}
            isPlayable={isCurrentTurn && legalCardIds.includes(card.id)}
            index={index}
            total={sortedCards.length}
            animationsEnabled={animationsEnabled}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Badge
          variant={isCurrentTurn ? "default" : "secondary"}
          className={cn("text-sm", isCurrentTurn && "bg-primary text-primary-foreground animate-pulse")}
        >
          {player.name}
        </Badge>
        {isCurrentTurn && <span className="text-sm text-primary">Your turn - select a card</span>}
      </div>
    </div>
  )
}

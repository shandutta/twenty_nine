"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Hand } from "./hand";
import type { GameState, PlayingCard, Player, Suit } from "@/components/game/types";

interface GameTableProps {
  gameState: GameState;
  onPlayCard: (card: PlayingCard) => void;
  legalCardIds: string[];
  animationsEnabled: boolean;
}

const suitSymbols: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

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
        <span className={cn("text-[10px] md:text-xs -mt-0.5", suitColor)}>{suitSymbols[card.suit]}</span>
      </div>

      <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
        <span className={cn("text-[10px] md:text-xs font-semibold", suitColor)}>{card.rank}</span>
        <span className={cn("text-[10px] md:text-xs -mt-0.5", suitColor)}>{suitSymbols[card.suit]}</span>
      </div>

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
                suitColorBg
              )}
            >
              <span className={cn("text-lg md:text-xl font-semibold", suitColor)}>{card.rank}</span>
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
  const sizeClasses = size === "small" ? "h-14 w-10 md:h-16 md:w-11" : "h-16 w-11 md:h-20 md:w-14";

  return (
    <div className={cn(sizeClasses, "rounded-lg bg-[#0f1f17] shadow-lg border border-white/10 overflow-hidden")}>
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

function StatusChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-full border px-3 py-2",
        highlight ? "border-[#f2c879] bg-[#f2c879] text-[#2b1c07]" : "border-white/15 bg-black/30 text-emerald-50"
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
        <div className={cn("flex -space-x-5", isActive && "ring-2 ring-[#f2c879]/40 rounded-2xl p-2")}>
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
      <div className={cn("flex -space-x-6", isActive && "ring-2 ring-[#f2c879]/40 rounded-2xl p-2")}>
        {Array.from({ length: cardCount }).map((_, i) => (
          <CardBack key={i} size="small" />
        ))}
      </div>
    </div>
  );
}

export function GameTable({ gameState, onPlayCard, legalCardIds, animationsEnabled }: GameTableProps) {
  const bottomPlayer = gameState.players.find((p) => p.position === "bottom")!;
  const leftPlayer = gameState.players.find((p) => p.position === "left")!;
  const topPlayer = gameState.players.find((p) => p.position === "top")!;
  const rightPlayer = gameState.players.find((p) => p.position === "right")!;

  const getPlayedCard = (playerId: string) => gameState.currentTrick.find((t) => t.playerId === playerId)?.card;

  const teamA = gameState.teams.teamA;
  const teamB = gameState.teams.teamB;
  const bidderName = gameState.players.find((p) => p.id === gameState.bidWinner)?.name ?? "-";
  const trumpLabel = gameState.trumpRevealed && gameState.trumpSuit ? suitSymbols[gameState.trumpSuit] : "Hidden";

  return (
    <TooltipProvider>
      <div className="relative h-full w-full p-4 md:p-8">
        <div className="absolute inset-4 md:inset-8 rounded-[36px] border border-white/10 bg-[var(--color-felt)] shadow-[0_30px_90px_rgba(0,0,0,0.55)] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(0,0,0,0.5),_transparent_70%)]" />
          <div className="absolute inset-6 rounded-[28px] border border-white/10" />
          <div className="absolute inset-6 rounded-[28px] border border-white/5 [background-image:repeating-linear-gradient(120deg,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_7px)]" />
        </div>

        <div className="relative h-full flex flex-col px-4 md:px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge className="border border-white/15 bg-white/5 text-emerald-50">Solo Table</Badge>
              <span className="text-xs uppercase tracking-[0.3em] text-emerald-100/60">
                Round {gameState.roundNumber}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusChip label="Contract" value={`${gameState.currentBid ?? "--"} · ${bidderName}`} />
              <StatusChip label="Trump" value={trumpLabel} highlight={gameState.trumpRevealed} />
              <StatusChip label="Trick" value={`${Math.min(gameState.trickNumber + 1, 8)} / 8`} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-xs text-emerald-100/70">
              <div className="flex items-center justify-between gap-6">
                <span className="text-emerald-200">You + North</span>
                <span className="text-emerald-50">
                  {teamA.tricksWon} tricks · {teamA.handPoints} pts
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-6">
                <span className="text-rose-200">West + East</span>
                <span className="text-emerald-50">
                  {teamB.tricksWon} tricks · {teamB.handPoints} pts
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-4">
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
              <div className="relative w-64 h-48 md:w-72 md:h-56">
                <div className="absolute inset-0 rounded-3xl border border-white/10 bg-black/20" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2">
                  {getPlayedCard(topPlayer.id) ? (
                    <div className={cn(animationsEnabled && "animate-in fade-in slide-in-from-top-4 duration-300")}>
                      <PlayedCard card={getPlayedCard(topPlayer.id)!} />
                    </div>
                  ) : (
                    <div className="h-[100px] w-[70px] md:h-[120px] md:w-[84px] rounded-lg border-2 border-dashed border-white/20" />
                  )}
                </div>

                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                  {getPlayedCard(leftPlayer.id) ? (
                    <div className={cn(animationsEnabled && "animate-in fade-in slide-in-from-left-4 duration-300")}>
                      <PlayedCard card={getPlayedCard(leftPlayer.id)!} />
                    </div>
                  ) : (
                    <div className="h-[100px] w-[70px] md:h-[120px] md:w-[84px] rounded-lg border-2 border-dashed border-white/20" />
                  )}
                </div>

                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                  {getPlayedCard(rightPlayer.id) ? (
                    <div className={cn(animationsEnabled && "animate-in fade-in slide-in-from-right-4 duration-300")}>
                      <PlayedCard card={getPlayedCard(rightPlayer.id)!} />
                    </div>
                  ) : (
                    <div className="h-[100px] w-[70px] md:h-[120px] md:w-[84px] rounded-lg border-2 border-dashed border-white/20" />
                  )}
                </div>

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

            <div className="flex-shrink-0">
              <OpponentArea
                player={rightPlayer}
                position="right"
                isTeammate={false}
                isActive={rightPlayer.isCurrentPlayer}
              />
            </div>
          </div>

          <div className="pt-2 pb-4 md:pb-6">
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
    </TooltipProvider>
  );
}

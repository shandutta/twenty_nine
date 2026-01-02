"use client";

import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Player, PlayingCard, Suit } from "@/components/game/types";

interface HandProps {
  player: Player;
  onPlayCard: (card: PlayingCard) => void;
  isCurrentTurn: boolean;
  legalCardIds: string[];
  animationsEnabled: boolean;
}

const suitSymbols: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const suitNames: Record<Suit, string> = {
  hearts: "Hearts",
  diamonds: "Diamonds",
  clubs: "Clubs",
  spades: "Spades",
};

const suitOrder: Suit[] = ["spades", "hearts", "clubs", "diamonds"];
const rankOrder = ["J", "9", "A", "10", "K", "Q", "8", "7"];

function getSuitColor(suit: Suit) {
  return suit === "hearts" || suit === "diamonds" ? "text-rose-500" : "text-slate-900";
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
};

function moveCard(order: string[], draggedId: string, targetId: string) {
  const current = [...order];
  const fromIndex = current.indexOf(draggedId);
  const toIndex = current.indexOf(targetId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return order;
  current.splice(fromIndex, 1);
  current.splice(toIndex, 0, draggedId);
  return current;
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

function PlayableCard({
  card,
  onClick,
  isPlayable,
  index,
  total,
  animationsEnabled,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  card: PlayingCard;
  onClick: () => void;
  isPlayable: boolean;
  index: number;
  total: number;
  animationsEnabled: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const suitColor = getSuitColor(card.suit);
  const suitColorBg = card.suit === "hearts" || card.suit === "diamonds" ? "bg-rose-50" : "bg-slate-50";
  const suitColorBorder = card.suit === "hearts" || card.suit === "diamonds" ? "border-rose-300" : "border-slate-300";
  const pips = getPipPositions(card.rank);
  const isFace = isFaceCard(card.rank);
  const isAce = card.rank === "A";

  const centerOffset = (total - 1) / 2;
  const rotation = (index - centerOffset) * 3;
  const yOffset = Math.abs(index - centerOffset) * 2;
  const shouldAnimate = animationsEnabled && isPlayable;
  const isLifted = shouldAnimate && (isHovered || isDragging);

  const handleClick = () => {
    if (!isPlayable || isDragging) return;
    onClick();
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            aria-label={`${card.rank} of ${suitNames[card.suit]}`}
            aria-disabled={!isPlayable}
            aria-grabbed={isDragging}
            className={cn(
              "relative rounded-xl bg-white/92 backdrop-blur-[2px] shadow-lg border overflow-hidden select-none cursor-grab active:cursor-grabbing",
              animationsEnabled && "transition-all duration-200",
              "h-[110px] w-[76px] md:h-[150px] md:w-[105px]",
              isPlayable
                ? "border-[#f2c879] ring-2 ring-[#f2c879]/40 hover:shadow-2xl"
                : "border-white/20 bg-white/85 opacity-80",
              isDragOver && !isDragging && "ring-2 ring-emerald-200/70",
              isDragging && "shadow-[0_22px_55px_rgba(0,0,0,0.35)]"
            )}
            style={{
              transform: `rotate(${isLifted ? 0 : rotation}deg) translateY(${isLifted ? -22 : yOffset}px) scale(${isDragging ? 1.04 : 1})`,
              marginLeft: index === 0 ? 0 : "-1.25rem",
              zIndex: isHovered || isDragging ? 60 : index,
            }}
          >
            <div className="absolute top-1.5 left-2 flex flex-col items-center leading-none">
              <span className={cn("text-sm md:text-base font-semibold", suitColor)}>{card.rank}</span>
              <span className={cn("text-sm md:text-base -mt-0.5", suitColor)}>{suitSymbols[card.suit]}</span>
            </div>

            <div className="absolute bottom-1.5 right-2 flex flex-col items-center leading-none rotate-180">
              <span className={cn("text-sm md:text-base font-semibold", suitColor)}>{card.rank}</span>
              <span className={cn("text-sm md:text-base -mt-0.5", suitColor)}>{suitSymbols[card.suit]}</span>
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[50px] h-[80px] md:w-[60px] md:h-[100px]">
                {isAce ? (
                  <div className="h-full flex items-center justify-center">
                    <span className={cn("text-5xl md:text-6xl", suitColor)}>{suitSymbols[card.suit]}</span>
                  </div>
                ) : isFace ? (
                  <div
                    className={cn(
                      "h-full w-full rounded border-2 flex flex-col items-center justify-center gap-1",
                      suitColorBorder,
                      suitColorBg
                    )}
                  >
                    <span className={cn("text-2xl md:text-3xl font-semibold", suitColor)}>{card.rank}</span>
                    <span className={cn("text-xl md:text-2xl", suitColor)}>{suitSymbols[card.suit]}</span>
                  </div>
                ) : (
                  <div className="relative h-full w-full">
                    {pips.map((pos, i) => (
                      <span
                        key={i}
                        className={cn(
                          "absolute text-base md:text-lg transform -translate-x-1/2 -translate-y-1/2",
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

            {cardValues[card.rank] > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full bg-[#f2c879] text-[10px] md:text-xs font-bold flex items-center justify-center text-[#2b1c07] shadow">
                {cardValues[card.rank]}
              </div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>
            {card.rank} of {suitNames[card.suit]} ({cardValues[card.rank]} pts)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function Hand({ player, onPlayCard, isCurrentTurn, legalCardIds, animationsEnabled }: HandProps) {
  const sortedCards = useMemo(() => {
    return [...player.cards].sort((a, b) => {
      const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      if (suitDiff !== 0) return suitDiff;
      return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
    });
  }, [player.cards]);

  const defaultOrder = useMemo(() => sortedCards.map((card) => card.id), [sortedCards]);
  const [cardOrder, setCardOrder] = useState<string[]>(() => defaultOrder);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    setCardOrder((prev) => {
      const currentIds = player.cards.map((card) => card.id);
      const currentSet = new Set(currentIds);
      const filteredPrev = prev.filter((id) => currentSet.has(id));
      const missing = defaultOrder.filter((id) => !filteredPrev.includes(id));
      const nextOrder = filteredPrev.length ? [...filteredPrev, ...missing] : defaultOrder;
      if (nextOrder.length === prev.length && nextOrder.every((id, i) => id === prev[i])) {
        return prev;
      }
      return nextOrder;
    });
  }, [player.cards, defaultOrder]);

  const orderedCards = useMemo(() => {
    const cardMap = new Map(player.cards.map((card) => [card.id, card]));
    return cardOrder.map((id) => cardMap.get(id)).filter(Boolean) as PlayingCard[];
  }, [player.cards, cardOrder]);

  const handleDragStart = (cardId: string) => (event: DragEvent<HTMLButtonElement>) => {
    setDraggingId(cardId);
    event.dataTransfer.setData("text/plain", cardId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (cardId: string) => (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (dragOverId !== cardId) {
      setDragOverId(cardId);
    }
  };

  const handleDrop = (cardId: string) => (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const draggedId = draggingId ?? event.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === cardId) {
      setDragOverId(null);
      return;
    }
    setCardOrder((prev) => moveCard(prev, draggedId, cardId));
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between px-4 md:px-12">
        <span className="text-xs uppercase tracking-[0.35em] text-emerald-100/60">Your hand</span>
        <span
          className={cn(
            "text-xs uppercase tracking-[0.35em]",
            isCurrentTurn ? "text-[#f2c879]" : "text-emerald-100/40"
          )}
        >
          {isCurrentTurn ? "Your turn" : "Waiting"}
        </span>
      </div>

      <div className="flex justify-center items-end px-10 md:px-16 py-2">
        {orderedCards.map((card, index) => (
          <PlayableCard
            key={card.id}
            card={card}
            onClick={() => onPlayCard(card)}
            isPlayable={isCurrentTurn && legalCardIds.includes(card.id)}
            index={index}
            total={orderedCards.length}
            animationsEnabled={animationsEnabled}
            isDragging={draggingId === card.id}
            isDragOver={dragOverId === card.id}
            onDragStart={handleDragStart(card.id)}
            onDragOver={handleDragOver(card.id)}
            onDrop={handleDrop(card.id)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-white/15 bg-white/5 text-emerald-50">
          {player.name}
        </Badge>
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] md:text-xs text-emerald-100/70 backdrop-blur">
          {isCurrentTurn ? (
            <span className="text-[#f2c879]">Play a legal card</span>
          ) : (
            <span className="text-emerald-100/60">Reorder your hand</span>
          )}
          <span className="text-emerald-100/35">Drag to reorder</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useTwentyNineGame } from "@/lib/use-twentynine-game";
import { cn } from "@/lib/utils";
import type { Card, Suit } from "@/lib/engine";

const suitLabel: Record<Suit, string> = {
  clubs: "C",
  diamonds: "D",
  hearts: "H",
  spades: "S",
};

const cardId = (card: Card) => `${card.rank}-${card.suit}`;

const seatLabels = ["You", "Right Bot", "Top Bot", "Left Bot"];

const seatPositions: Record<number, string> = {
  0: "bottom-4 left-1/2 -translate-x-1/2",
  1: "right-6 top-1/2 -translate-y-1/2",
  2: "top-6 left-1/2 -translate-x-1/2",
  3: "left-6 top-1/2 -translate-y-1/2",
};

const trickPositions: Record<number, string> = {
  0: "bottom-24 left-1/2 -translate-x-1/2",
  1: "right-28 top-1/2 -translate-y-1/2",
  2: "top-24 left-1/2 -translate-x-1/2",
  3: "left-28 top-1/2 -translate-y-1/2",
};

const CardFace = ({ card }: { card: Card }) => {
  return (
    <div className="flex h-16 w-12 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/90 text-sm font-semibold text-slate-900 shadow-[0_10px_24px_-12px_rgba(15,23,42,0.8)]">
      <span className="text-xs uppercase tracking-wide text-slate-500">
        {card.rank}
      </span>
      <span className="text-lg">{suitLabel[card.suit]}</span>
    </div>
  );
};

const CardButton = ({
  card,
  isLegal,
  isActive,
  onPlay,
}: {
  card: Card;
  isLegal: boolean;
  isActive: boolean;
  onPlay: (card: Card) => void;
}) => {
  const disabled = !isLegal || !isActive;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPlay(card)}
      className={cn(
        "group relative h-24 w-16 rounded-2xl border border-white/15 bg-white/90 px-2 py-3 text-left text-sm font-semibold text-slate-900 shadow-[0_16px_32px_-18px_rgba(15,23,42,0.8)] transition",
        "hover:-translate-y-1 hover:shadow-[0_18px_32px_-16px_rgba(15,23,42,0.9)]",
        disabled && "cursor-not-allowed opacity-40 hover:translate-y-0",
        isLegal && isActive && "ring-2 ring-amber-300/80",
      )}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {card.rank}
      </div>
      <div className="text-lg">{suitLabel[card.suit]}</div>
    </button>
  );
};

export default function Home() {
  const { state, legalPlays, playCardForHuman, reset } = useTwentyNineGame();

  const trickNumber = Math.min(state.trickIndex + 1, 8);

  const legalSet = useMemo(() => {
    return new Set(legalPlays.map(cardId));
  }, [legalPlays]);

  const canPlay = state.currentPlayer === 0 && state.status === "playing";
  const hand = state.hands[0] ?? [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(254,240,138,0.35),_transparent_60%),radial-gradient(circle_at_15%_80%,_rgba(56,189,248,0.12),_transparent_55%),linear-gradient(140deg,_rgba(255,251,235,0.98),_rgba(240,253,244,0.96))] px-4 py-6 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 lg:flex-row">
        <div className="flex flex-1 flex-col gap-6">
          <header className="flex flex-col gap-2 animate-rise">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-700/80">
              Twenty-Nine Table
            </p>
            <h1 className="font-display text-3xl font-semibold text-slate-900 sm:text-4xl">
              Trick {trickNumber} of 8
            </h1>
          </header>

          <section className="relative flex-1 rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_30%_20%,_rgba(22,163,74,0.35),_transparent_55%),radial-gradient(circle_at_70%_80%,_rgba(16,185,129,0.25),_transparent_50%),linear-gradient(160deg,_rgba(15,118,110,0.35),_rgba(15,23,42,0.55))] p-6 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.9)] animate-rise animate-stagger-1">
            <div className="absolute inset-0 rounded-[32px] border border-white/10 opacity-70" />
            <div className="absolute left-1/2 top-1/2 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xs uppercase tracking-[0.3em] text-emerald-100/70">
              Trick
            </div>

            {state.trick.plays.map((play) => (
              <div
                key={cardId(play.card)}
                className={cn(
                  "absolute",
                  trickPositions[play.player] ?? "left-1/2 top-1/2",
                )}
              >
                <CardFace card={play.card} />
              </div>
            ))}

            {seatLabels.map((label, index) => (
              <div
                key={label}
                className={cn(
                  "absolute flex flex-col items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-emerald-50/80",
                  seatPositions[index],
                  state.currentPlayer === index &&
                    state.status === "playing" &&
                    "border-amber-300/80 text-amber-100",
                )}
              >
                <span>{label}</span>
                <span className="text-[10px] text-emerald-100/60">
                  {state.hands[index]?.length ?? 0} cards
                </span>
              </div>
            ))}
          </section>

          <section className="rounded-[28px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_16px_40px_-30px_rgba(148,163,184,0.6)] animate-rise animate-stagger-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-700/80">
                  Your hand
                </p>
                <p className="text-sm text-slate-600">
                  {canPlay ? "Your turn. Play a legal card." : "Waiting on bots..."}
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-700 transition hover:border-amber-400 hover:text-amber-800"
              >
                New hand
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {hand.map((card) => (
                <CardButton
                  key={cardId(card)}
                  card={card}
                  isLegal={legalSet.has(cardId(card))}
                  isActive={canPlay}
                  onPlay={playCardForHuman}
                />
              ))}
            </div>
            {state.status === "hand-complete" && (
              <div className="mt-4 rounded-2xl border border-amber-400/50 bg-amber-100/60 p-4 text-sm text-amber-900">
                Hand complete. Team 1: {state.scores[0]}, Team 2: {state.scores[1]}.
              </div>
            )}
          </section>
        </div>

        <aside className="w-full max-w-xl rounded-[28px] border border-slate-200/70 bg-white/85 p-6 shadow-[0_20px_50px_-40px_rgba(148,163,184,0.6)] animate-rise animate-stagger-3 lg:w-72">
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700/80">
                Contract
              </p>
              <div className="mt-2 rounded-2xl border border-slate-200/70 bg-white/90 p-3 text-sm">
                <div className="flex items-center justify-between text-slate-900">
                  <span>Bidder</span>
                  <span className="font-semibold">Team 1</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-slate-600">
                  <span>Target</span>
                  <span>16</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700/80">
                Trump
              </p>
              <div className="mt-2 rounded-2xl border border-slate-200/70 bg-white/90 p-3 text-sm text-slate-900">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="font-semibold">
                    {state.trumpRevealed ? "Revealed" : "Hidden"}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-slate-600">
                  <span>Suit</span>
                  <span>{state.trumpSuit}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700/80">
                Score
              </p>
              <div className="mt-2 rounded-2xl border border-slate-200/70 bg-white/90 p-3 text-sm text-slate-900">
                <div className="flex items-center justify-between">
                  <span>Team 1</span>
                  <span className="font-semibold">{state.scores[0]}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-slate-600">
                  <span>Team 2</span>
                  <span>{state.scores[1]}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700/80">
                Log
              </p>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200/70 bg-slate-900/90 p-3 text-xs text-slate-100/80">
                {state.log
                  .slice()
                  .reverse()
                  .map((entry, index) => (
                    <div key={`${entry}-${index}`} className="leading-relaxed">
                      {entry}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

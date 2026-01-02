"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Card, Suit } from "@twentynine/engine";
import { GameTable } from "@/components/game/table";
import { GameSidebar } from "@/components/game/sidebar";
import { SettingsSheet } from "@/components/game/settings-sheet";
import { useGameController } from "@/components/game/use-game-controller";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const suitSymbols: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const formatCard = (card: Card): string => `${card.rank}${suitSymbols[card.suit]}`;

const formatCardList = (cards: Card[]): string => (cards.length === 0 ? "--" : cards.map(formatCard).join(", "));

function GameShell({ children, hydrated }: { children: ReactNode; hydrated: boolean }) {
  return (
    <div
      className="relative flex h-screen w-full overflow-hidden bg-[#0b1511]"
      data-hydrated={hydrated ? "true" : "false"}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(15,118,110,0.2),_transparent_50%)]" />
      {children}
    </div>
  );
}

function GameLoading() {
  return (
    <GameShell hydrated={false}>
      <main className="relative flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-black/40 px-4 py-2 text-emerald-50">
            <Spinner className="size-5 text-[#f2c879]" />
            <span className="text-sm uppercase tracking-[0.2em]">Shuffling the deck</span>
          </div>
          <p className="text-xs text-emerald-100/70">Setting the felt and dealing the first hand.</p>
        </div>
      </main>
    </GameShell>
  );
}

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function GamePageClient() {
  const {
    gameState,
    engineState,
    legalCardIds,
    onPlayCard,
    onNewGame,
    canRevealTrump,
    onRevealTrump,
    canDeclareRoyals,
    onDeclareRoyals,
    lastMove,
    botSettings,
    llmInUse,
    setBotEnabled,
    setBotDifficulty,
  } = useGameController();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [coachEnabled, setCoachEnabled] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachResponse, setCoachResponse] = useState<string | null>(null);
  const [openRouterConfigured, setOpenRouterConfigured] = useState<boolean | null>(null);
  const [confirmNewGameOpen, setConfirmNewGameOpen] = useState(false);

  const playerLabel = useMemo(() => {
    return (player: number) => gameState.players[player]?.name ?? `P${player + 1}`;
  }, [gameState.players]);

  const lastMoveSummary = lastMove
    ? `${playerLabel(lastMove.action.player)} played ${formatCard(lastMove.action.card)}`
    : "No moves yet.";

  const legalAlternatives = lastMove ? formatCardList(lastMove.legalMoves) : "--";

  const canRequestCoach = coachEnabled && Boolean(lastMove) && !coachLoading && openRouterConfigured !== false;
  const requestNewGame = () => setConfirmNewGameOpen(true);

  const confirmNewGame = () => {
    onNewGame();
    setConfirmNewGameOpen(false);
  };

  useEffect(() => {
    let isMounted = true;
    const checkConfig = async () => {
      try {
        const response = await fetch("/api/openrouter");
        const data = (await response.json().catch(() => null)) as { configured?: boolean } | null;
        if (isMounted) {
          setOpenRouterConfigured(Boolean(data?.configured));
        }
      } catch {
        if (isMounted) {
          setOpenRouterConfigured(false);
        }
      }
    };
    void checkConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setCoachResponse(null);
    setCoachError(null);
  }, [lastMove?.action, coachEnabled]);

  const requestCoach = async () => {
    if (!coachEnabled || !lastMove) {
      return;
    }
    if (openRouterConfigured === false) {
      setCoachError("Set OPENROUTER_API_KEY in apps/web/.env.local first.");
      return;
    }
    setCoachLoading(true);
    setCoachError(null);
    setCoachResponse(null);

    const message = {
      trump: engineState.trumpRevealed ? engineState.trumpSuit : "hidden",
      currentTrick: engineState.trick.plays.map((play) => ({
        player: playerLabel(play.player),
        card: formatCard(play.card),
      })),
      completedTricks: engineState.trickNumber,
      score: { team0: engineState.points[0], team1: engineState.points[1] },
      lastMove: {
        player: playerLabel(lastMove.action.player),
        card: formatCard(lastMove.action.card),
      },
      legalAlternatives: lastMove.legalMoves.map(formatCard),
    };

    try {
      const response = await fetch("/api/openrouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "You are a 29 card game coach. Briefly evaluate the last move and suggest 1-2 alternatives. Be concise.",
            },
            {
              role: "user",
              content: `Analyze this state and last move:\n${JSON.stringify(message, null, 2)}`,
            },
          ],
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        message?: { content?: string };
      } | null;

      if (!response.ok) {
        setCoachError(data?.error ?? "OpenRouter request failed.");
        return;
      }

      const content = data?.message?.content;
      if (!content) {
        setCoachError("No response from coach.");
        return;
      }
      setCoachResponse(content);
    } catch {
      setCoachError("Unable to reach OpenRouter.");
    } finally {
      setCoachLoading(false);
    }
  };

  return (
    <GameShell hydrated>
      <GameSidebar
        gameState={gameState}
        onNewGame={requestNewGame}
        onOpenSettings={() => setSettingsOpen(true)}
        botSettings={botSettings}
        onBotEnabledChange={setBotEnabled}
        onBotDifficultyChange={setBotDifficulty}
        coachEnabled={coachEnabled}
        onCoachEnabledChange={setCoachEnabled}
        coachLoading={coachLoading}
        coachError={coachError}
        coachResponse={coachResponse}
        onRequestCoach={requestCoach}
        lastMoveSummary={lastMoveSummary}
        legalAlternatives={legalAlternatives}
        canRequestCoach={canRequestCoach}
      />
      <main className="relative flex-1 overflow-hidden">
        <GameTable
          gameState={gameState}
          onPlayCard={onPlayCard}
          legalCardIds={legalCardIds}
          animationsEnabled={animationsEnabled}
          onNewGame={requestNewGame}
          canRevealTrump={canRevealTrump}
          onRevealTrump={onRevealTrump}
          canDeclareRoyals={canDeclareRoyals}
          onDeclareRoyals={onDeclareRoyals}
          llmInUse={llmInUse}
        />
      </main>
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        soundEnabled={soundEnabled}
        onSoundChange={setSoundEnabled}
        animationsEnabled={animationsEnabled}
        onAnimationsChange={setAnimationsEnabled}
        autoPlay={autoPlay}
        onAutoPlayChange={setAutoPlay}
        onNewGame={requestNewGame}
      />
      <AlertDialog open={confirmNewGameOpen} onOpenChange={setConfirmNewGameOpen}>
        <AlertDialogContent className="border-white/10 bg-[#0c1813] text-emerald-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new game?</AlertDialogTitle>
            <AlertDialogDescription className="text-emerald-100/70">
              This will shuffle a fresh deck, reset the current round, and clear the trick log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-white/5 text-emerald-50 hover:bg-white/10">
              Keep Playing
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmNewGame} className="bg-[#f2c879] text-[#2b1c07] hover:bg-[#f8d690]">
              Start New Game
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GameShell>
  );
}

export default function GamePage() {
  const hydrated = useHydrated();

  if (!hydrated) {
    return <GameLoading />;
  }

  return <GamePageClient />;
}

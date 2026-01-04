"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Card, Suit } from "@twentynine/engine";
import { GameTable } from "@/components/game/table";
import { GameSidebar } from "@/components/game/sidebar";
import { SettingsSheet } from "@/components/game/settings-sheet";
import { useSoundEffects } from "@/components/game/use-sound-effects";
import { useGameController } from "@/components/game/use-game-controller";
import { Spinner } from "@/components/ui/spinner";
import type { MatchTrack } from "@/components/game/types";
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
import { Trophy } from "lucide-react";

const suitSymbols: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const MATCH_CARD_BASE =
  "relative h-9 w-7 rounded-[0.6rem] border bg-gradient-to-br from-[#162820] via-[#0d1913] to-[#0a120e] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_18px_rgba(0,0,0,0.45)]";

const MATCH_PIP_STYLES = {
  bid: "bg-[#e85b5b] ring-1 ring-rose-200/60 shadow-[0_0_12px_rgba(232,91,91,0.55)]",
  set: "bg-[#0a0a0a] ring-1 ring-white/30 shadow-[inset_0_0_8px_rgba(255,255,255,0.18)]",
  empty: "bg-white/10 ring-1 ring-white/10",
} as const;

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
    bidOptions,
    canBid,
    onPlaceBid,
    onPassBid,
    canChooseTrump,
    onChooseTrump,
    onChooseTrumpFromSeventh,
    onNewGame,
    canRevealTrump,
    onRevealTrump,
    canDeclareRoyals,
    onDeclareRoyals,
    lastMove,
    botSettings,
    llmInUse,
    llmReasoning,
    llmReasoningMeta,
    setBotEnabled,
    setBotDifficulty,
    setBotModel,
    setBotTemperature,
    setReasoningEffort,
    setShowReasoningTrace,
    controlMode,
    controlModeLocked,
    onControlModeChange,
  } = useGameController();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(75);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [targetScore, setTargetScore] = useState(6);
  const [matchTrack, setMatchTrack] = useState<MatchTrack>({ teamA: 0, teamB: 0 });
  const lastScoredHandRef = useRef<number | null>(null);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [coachEnabled, setCoachEnabled] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachResponse, setCoachResponse] = useState<string | null>(null);
  const [openRouterConfigured, setOpenRouterConfigured] = useState<boolean | null>(null);
  const [confirmNewGameOpen, setConfirmNewGameOpen] = useState(false);

  useSoundEffects({
    enabled: soundEnabled,
    volume: soundVolume,
    log: gameState.log,
    roundNumber: gameState.roundNumber,
  });

  const playerLabel = useMemo(() => {
    return (player: number) => gameState.players[player]?.name ?? `P${player + 1}`;
  }, [gameState.players]);

  const teamAName = gameState.teams.teamA.name;
  const teamBName = gameState.teams.teamB.name;

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

  const startNewMatch = () => {
    setMatchTrack({ teamA: 0, teamB: 0 });
    lastScoredHandRef.current = null;
    setMatchDialogOpen(false);
    setConfirmNewGameOpen(false);
    onNewGame();
  };

  const formatMatchScore = (score: number) => {
    if (score === 0) return "0";
    return `${score > 0 ? "+" : "-"}${Math.abs(score)}`;
  };

  const renderMatchCards = (score: number, teamTone: "teamA" | "teamB") => {
    const pipTone = score > 0 ? "bid" : score < 0 ? "set" : "empty";
    const filledCount = Math.abs(score);
    const teamBorder = teamTone === "teamA" ? "border-emerald-400/30" : "border-rose-400/30";

    return (
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {Array.from({ length: targetScore }, (_, index) => {
          const active = index < filledCount;
          const tone = active ? pipTone : "empty";
          const pipClass =
            tone === "bid"
              ? MATCH_PIP_STYLES.bid
              : tone === "set"
                ? MATCH_PIP_STYLES.set
                : MATCH_PIP_STYLES.empty;

          return (
            <div key={`match-${teamTone}-${index}`} className={`${MATCH_CARD_BASE} ${teamBorder}`}>
              <span
                className={`absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${pipClass}`}
              />
              <span className="pointer-events-none absolute inset-[3px] rounded-[0.45rem] border border-white/5" />
            </div>
          );
        })}
      </div>
    );
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

  const matchWinner = useMemo(() => {
    if (matchTrack.teamA >= targetScore) {
      return { winner: "teamA" as const, reason: `Reached +${targetScore}` };
    }
    if (matchTrack.teamA <= -targetScore) {
      return { winner: "teamB" as const, reason: `${teamAName} fell to -${targetScore}` };
    }
    if (matchTrack.teamB >= targetScore) {
      return { winner: "teamB" as const, reason: `Reached +${targetScore}` };
    }
    if (matchTrack.teamB <= -targetScore) {
      return { winner: "teamA" as const, reason: `${teamBName} fell to -${targetScore}` };
    }
    return null;
  }, [matchTrack.teamA, matchTrack.teamB, targetScore, teamAName, teamBName]);

  useEffect(() => {
    if (!matchWinner) {
      setMatchDialogOpen(false);
      return;
    }
    setMatchDialogOpen(true);
  }, [matchWinner]);

  useEffect(() => {
    setMatchTrack((prev) => ({
      teamA: Math.max(-targetScore, Math.min(targetScore, prev.teamA)),
      teamB: Math.max(-targetScore, Math.min(targetScore, prev.teamB)),
    }));
  }, [targetScore]);

  useEffect(() => {
    setMatchTrack({ teamA: 0, teamB: 0 });
    lastScoredHandRef.current = null;
  }, [controlMode]);

  useEffect(() => {
    if (engineState.phase !== "hand-complete") return;
    if (lastScoredHandRef.current === engineState.seed) return;
    lastScoredHandRef.current = engineState.seed;

    const bidderTeam = engineState.bidderTeam;
    const bidTarget = engineState.bidTarget;
    if (bidderTeam === null || bidTarget === null) return;

    const bidderPoints = engineState.points[bidderTeam];
    const bidderMade = bidderPoints >= bidTarget;
    const biddingKey = bidderTeam === 0 ? "teamA" : "teamB";
    const delta = bidderMade ? 1 : -1;

    setMatchTrack((prev) => {
      const nextValue = Math.max(-targetScore, Math.min(targetScore, prev[biddingKey] + delta));
      if (nextValue === prev[biddingKey]) return prev;
      return {
        ...prev,
        [biddingKey]: nextValue,
      };
    });
  }, [engineState, targetScore]);

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
      trump: engineState.trumpRevealed ? (engineState.trumpSuit ?? "joker (no trump)") : "hidden",
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
        targetScore={targetScore}
        matchTrack={matchTrack}
        botSettings={botSettings}
        onBotEnabledChange={setBotEnabled}
        onBotDifficultyChange={setBotDifficulty}
        onBotModelChange={setBotModel}
        onBotTemperatureChange={setBotTemperature}
        onReasoningEffortChange={setReasoningEffort}
        onShowReasoningTraceChange={setShowReasoningTrace}
        controlMode={controlMode}
        onControlModeChange={onControlModeChange}
        controlModeLocked={controlModeLocked}
        coachEnabled={coachEnabled}
        onCoachEnabledChange={setCoachEnabled}
        coachLoading={coachLoading}
        coachError={coachError}
        coachResponse={coachResponse}
        onRequestCoach={requestCoach}
        lastMoveSummary={lastMoveSummary}
        legalAlternatives={legalAlternatives}
        canRequestCoach={canRequestCoach}
        bidOptions={bidOptions}
        canBid={canBid}
        onPlaceBid={onPlaceBid}
        onPassBid={onPassBid}
        canChooseTrump={canChooseTrump}
        onChooseTrump={onChooseTrump}
        onChooseTrumpFromSeventh={onChooseTrumpFromSeventh}
      />
      <main className="relative flex-1 overflow-hidden">
        <GameTable
          gameState={gameState}
          onPlayCard={onPlayCard}
          legalCardIds={legalCardIds}
          animationsEnabled={animationsEnabled}
          controlMode={controlMode}
          onControlModeChange={onControlModeChange}
          controlModeLocked={controlModeLocked}
          bidOptions={bidOptions}
          canBid={canBid}
          onPlaceBid={onPlaceBid}
          onPassBid={onPassBid}
          canChooseTrump={canChooseTrump}
          onChooseTrump={onChooseTrump}
          onChooseTrumpFromSeventh={onChooseTrumpFromSeventh}
          onNewGame={requestNewGame}
          canRevealTrump={canRevealTrump}
          onRevealTrump={onRevealTrump}
          canDeclareRoyals={canDeclareRoyals}
          onDeclareRoyals={onDeclareRoyals}
          llmInUse={llmInUse}
          llmReasoning={llmReasoning}
          llmReasoningMeta={llmReasoningMeta}
          showReasoningTrace={botSettings.showReasoningTrace}
        />
      </main>
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        soundEnabled={soundEnabled}
        onSoundChange={setSoundEnabled}
        soundVolume={soundVolume}
        onSoundVolumeChange={setSoundVolume}
        animationsEnabled={animationsEnabled}
        onAnimationsChange={setAnimationsEnabled}
        autoPlay={autoPlay}
        onAutoPlayChange={setAutoPlay}
        targetScore={targetScore}
        onTargetScoreChange={setTargetScore}
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
      <AlertDialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <AlertDialogContent className="border-white/10 bg-[#0c1813] text-emerald-50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-emerald-50">
              <span className="flex size-9 items-center justify-center rounded-full border border-[#f2c879]/40 bg-[#231708] text-[#f6d38b]">
                <Trophy className="size-4" />
              </span>
              Match Complete
            </AlertDialogTitle>
            <AlertDialogDescription className="text-emerald-100/70">
              {matchWinner
                ? `${matchWinner.winner === "teamA" ? teamAName : teamBName} win the match · ${matchWinner.reason}`
                : "Match results are ready."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-emerald-100/60">
              <span>Match Score</span>
              <span className="text-emerald-50">Target ±{targetScore}</span>
            </div>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-200">{teamAName}</span>
                  <span className="text-emerald-50">{formatMatchScore(matchTrack.teamA)}</span>
                </div>
                {renderMatchCards(matchTrack.teamA, "teamA")}
              </div>
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-rose-200">{teamBName}</span>
                  <span className="text-emerald-50">{formatMatchScore(matchTrack.teamB)}</span>
                </div>
                {renderMatchCards(matchTrack.teamB, "teamB")}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-emerald-100/50">
              <span className="inline-flex items-center gap-1">
                <span className={`size-1.5 rounded-full ${MATCH_PIP_STYLES.bid}`} />
                made bid
              </span>
              <span className="inline-flex items-center gap-1">
                <span className={`size-1.5 rounded-full ${MATCH_PIP_STYLES.set}`} />
                missed bid
              </span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-white/5 text-emerald-50 hover:bg-white/10">
              Keep Table
            </AlertDialogCancel>
            <AlertDialogAction onClick={startNewMatch} className="bg-[#f2c879] text-[#2b1c07] hover:bg-[#f8d690]">
              Start New Match
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

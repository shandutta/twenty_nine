"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { cardPoints, type Card, type Suit } from "@twentynine/engine";
import { GameTable } from "@/components/game/table";
import { GameSidebar } from "@/components/game/sidebar";
import { SettingsSheet } from "@/components/game/settings-sheet";
import { useSoundEffects } from "@/components/game/use-sound-effects";
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

type CardLike = { rank: Card["rank"]; suit: Suit };

const formatCard = (card: CardLike): string => `${card.rank}${suitSymbols[card.suit]}`;

const formatCardList = (cards: CardLike[]): string => (cards.length === 0 ? "--" : cards.map(formatCard).join(", "));

function GameShell({ children, hydrated }: { children: ReactNode; hydrated: boolean }) {
  return (
    <div
      className="relative flex h-[100svh] w-full overflow-hidden bg-[#0b1511] md:h-screen"
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
    onNextHand,
    canStartNextHand,
    canRevealTrump,
    onRevealTrump,
    canDeclareRoyals,
    onDeclareRoyals,
    lastMove,
    botSettings,
    llmInUse,
    setBotEnabled,
    setBotDifficulty,
    setBotModel,
    setBotTemperature,
    setReasoningEffort,
    trickResolution,
    onAcknowledgeTrickResolution,
    controlMode,
    controlModeLocked,
    onControlModeChange,
  } = useGameController();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(75);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [easyMode, setEasyMode] = useState(false);
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
    roundNumber: gameState.matchRound,
  });

  const playerLabel = useMemo(() => {
    return (player: number) => gameState.players[player]?.name ?? `P${player + 1}`;
  }, [gameState.players]);

  const playerNameById = useMemo(() => {
    const lookup = new Map(gameState.players.map((player) => [player.id, player.name]));
    return (id: string) => lookup.get(id) ?? "Player";
  }, [gameState.players]);

  const bottomPlayer = gameState.players.find((player) => player.position === "bottom") ?? gameState.players[0];
  const topPlayer = gameState.players.find((player) => player.position === "top") ?? gameState.players[2];
  const coachPlayerIds = useMemo(() => {
    if (!bottomPlayer) return [];
    if (controlMode === "single-hand" && topPlayer) {
      return [bottomPlayer.id, topPlayer.id];
    }
    return [bottomPlayer.id];
  }, [bottomPlayer, topPlayer, controlMode]);
  const isCoachTurn = coachPlayerIds.includes(gameState.currentPlayerId);
  const currentPlayer = gameState.players.find((player) => player.id === gameState.currentPlayerId) ?? bottomPlayer;
  const currentPlayerLegalMoves = currentPlayer
    ? currentPlayer.cards.filter((card) => legalCardIds.includes(card.id))
    : [];
  const legalMovesSummary = formatCardList(currentPlayerLegalMoves);
  const isNoTrump = gameState.trumpSuit === null && (gameState.phase === "playing" || gameState.phase === "finished");
  const visibleTrumpLabel = gameState.trumpSuit
    ? gameState.trumpRevealed
      ? suitSymbols[gameState.trumpSuit]
      : "Hidden"
    : isNoTrump
      ? "Joker (no trump)"
      : "Pending";

  const lastMoveSummary = lastMove
    ? `${playerLabel(lastMove.action.player)} played ${formatCard(lastMove.action.card)}`
    : "No moves yet.";

  const trickSummary = trickResolution.summary;
  const trickWinnerName = trickSummary ? playerNameById(trickSummary.winnerPlayerId) : "Player";
  const trickTeamName = trickSummary
    ? trickSummary.winnerTeamId === "teamA"
      ? gameState.teams.teamA.name
      : gameState.teams.teamB.name
    : "Team";
  const trickWinningCard = trickSummary ? formatCard(trickSummary.winningCard) : "--";
  const trickPoints = trickSummary?.points ?? 0;
  const trickNextLead = trickSummary ? playerNameById(gameState.currentPlayerId) : null;
  const trickDialogOpen = trickResolution.open && Boolean(trickSummary) && trickSummary?.trickNumber !== 8;

  const canRequestCoach =
    coachEnabled && isCoachTurn && gameState.phase === "playing" && !coachLoading && openRouterConfigured !== false;
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
    if (!trickResolution.pending) return;
    if (trickSummary?.trickNumber !== 8) return;
    onAcknowledgeTrickResolution();
  }, [onAcknowledgeTrickResolution, trickResolution.pending, trickSummary?.trickNumber]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("twentynine.easyMode");
      if (stored !== null) {
        setEasyMode(stored === "true");
      }
    } catch {
      // Ignore storage access errors.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("twentynine.easyMode", String(easyMode));
    } catch {
      // Ignore storage access errors.
    }
  }, [easyMode]);

  useEffect(() => {
    setCoachResponse(null);
    setCoachError(null);
  }, [gameState.currentPlayerId, gameState.trickNumber, gameState.phase, coachEnabled]);

  const requestCoach = async () => {
    if (!coachEnabled) {
      return;
    }
    if (!isCoachTurn || gameState.phase !== "playing") {
      setCoachError("Coach guidance is only available on your turn during play.");
      return;
    }
    if (openRouterConfigured === false) {
      setCoachError("Set OPENROUTER_API_KEY in apps/web/.env.local first.");
      return;
    }
    setCoachLoading(true);
    setCoachError(null);
    setCoachResponse(null);

    const currentPlayerName = currentPlayer!.name;
    const currentPlayerHand = currentPlayer!.cards.map(formatCard);
    const teamById = (teamId: "teamA" | "teamB") =>
      teamId === "teamA" ? gameState.teams.teamA : gameState.teams.teamB;
    const bidderTeamId = gameState.bidWinner
      ? gameState.teams.teamA.players.includes(gameState.bidWinner)
        ? "teamA"
        : "teamB"
      : null;
    const bidderTeam = bidderTeamId ? teamById(bidderTeamId) : null;
    const royalsTeam = gameState.royalsDeclaredBy ? teamById(gameState.royalsDeclaredBy) : null;
    const visibleHands = {
      you: bottomPlayer!.cards.map(formatCard),
      partner: controlMode === "single-hand" && topPlayer ? topPlayer.cards.map(formatCard) : undefined,
    };
    const message = {
      phase: gameState.phase,
      match: {
        round: gameState.matchRound,
        redPips: gameState.matchRedPips,
        blackPips: gameState.matchBlackPips,
        winner:
          gameState.matchWinner === null
            ? null
            : gameState.matchWinner === "teamA"
              ? gameState.teams.teamA.name
              : gameState.teams.teamB.name,
        endReason: gameState.matchEndReason,
      },
      contract: {
        bidTarget: gameState.currentBid,
        bidder: gameState.bidWinner ? playerNameById(gameState.bidWinner) : null,
        bidderTeam: bidderTeam?.name ?? null,
        royals: {
          declaredBy: royalsTeam?.name ?? null,
          adjustment: gameState.royalsAdjustment,
          minTarget: gameState.royalsMinTarget,
          maxTarget: gameState.royalsMaxTarget,
        },
      },
      trump: visibleTrumpLabel,
      trumpRevealed: gameState.trumpRevealed,
      score: {
        teamA: {
          name: gameState.teams.teamA.name,
          handPoints: gameState.teams.teamA.handPoints,
          tricksWon: gameState.teams.teamA.tricksWon,
        },
        teamB: {
          name: gameState.teams.teamB.name,
          handPoints: gameState.teams.teamB.handPoints,
          tricksWon: gameState.teams.teamB.tricksWon,
        },
      },
      trickNumber: gameState.trickNumber + 1,
      currentTrickPoints: gameState.currentTrick.reduce((sum, play) => sum + cardPoints(play.card), 0),
      currentTrick: gameState.currentTrick.map((play) => ({
        player: playerNameById(play.playerId),
        card: formatCard(play.card),
      })),
      lastTrick: gameState.lastTrick
        ? {
            trickNumber: gameState.lastTrick.trickNumber,
            winner: playerNameById(gameState.lastTrick.winnerPlayerId),
            points: gameState.lastTrick.points,
            plays: gameState.lastTrick.plays.map((play) => ({
              player: playerNameById(play.playerId),
              card: formatCard(play.card),
            })),
          }
        : null,
      visibleHands,
      currentPlayer: currentPlayerName,
      currentPlayerHand,
      legalMoves: currentPlayerLegalMoves.map(formatCard),
      legalMovesWithPoints: currentPlayerLegalMoves.map((card) => ({
        card: formatCard(card),
        points: cardPoints(card),
      })),
    };

    try {
      const response = await fetch("/api/openrouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          temperature: 0.3,
          trace: {
            source: "coach",
            matchRound: engineState.matchRound,
            trickNumber: engineState.trickNumber + 1,
            phase: engineState.phase,
            playerId: gameState.currentPlayerId,
            playerName: currentPlayerName,
            gameSeed: engineState.seed,
            turnId: engineState.log.length,
          },
          messages: [
            {
              role: "system",
              content:
                "You are a 29 card game coach for the human player. Use ONLY the visible info provided. Do NOT mention or infer hidden cards, unrevealed trump, or speculate about opponents' hands. Provide an in-depth, phase-aware coaching note that reflects the contract (bid target + bidder team), match/hand score, trick number, and trump visibility. Structure the response with short labeled sections in plain text: Situation (2-3 sentences), Objectives & risks (2-4 bullets), Tactics (2-4 bullets), Suggested plays (2-3 options). Only suggest cards that appear in legalMoves (write labels exactly as shown); you may use legalMovesWithPoints for point values. Keep it concise but substantive (~120-180 words).",
            },
            {
              role: "user",
              content: `Analyze this visible state for the current player's turn:\n${JSON.stringify(message, null, 2)}`,
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
        easyMode={easyMode}
        botSettings={botSettings}
        onBotEnabledChange={setBotEnabled}
        onBotDifficultyChange={setBotDifficulty}
        onBotModelChange={setBotModel}
        onBotTemperatureChange={setBotTemperature}
        onReasoningEffortChange={setReasoningEffort}
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
        legalMovesSummary={legalMovesSummary}
        canRequestCoach={canRequestCoach}
        bidOptions={bidOptions}
        canBid={canBid}
        onPlaceBid={onPlaceBid}
        onPassBid={onPassBid}
        canChooseTrump={canChooseTrump}
        onChooseTrump={onChooseTrump}
        onChooseTrumpFromSeventh={onChooseTrumpFromSeventh}
      />
      <main className="relative flex-1 min-h-0 overflow-x-hidden overflow-y-auto md:overflow-hidden">
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
          onNextHand={onNextHand}
          canStartNextHand={canStartNextHand}
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
        soundVolume={soundVolume}
        onSoundVolumeChange={setSoundVolume}
        animationsEnabled={animationsEnabled}
        onAnimationsChange={setAnimationsEnabled}
        autoPlay={autoPlay}
        onAutoPlayChange={setAutoPlay}
        easyMode={easyMode}
        onEasyModeChange={setEasyMode}
        onNewGame={requestNewGame}
      />
      <AlertDialog
        open={trickDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            onAcknowledgeTrickResolution();
          }
        }}
      >
        <AlertDialogContent className="border-white/10 bg-[#0c1813] text-emerald-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Trick {trickSummary?.trickNumber} resolved</AlertDialogTitle>
            <AlertDialogDescription className="text-emerald-100/70">
              {trickWinnerName} won for {trickTeamName}. +{trickPoints} pts. Winning card: {trickWinningCard}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {trickSummary && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-[clamp(11px,0.85vw,13px)] text-emerald-100/80">
                {trickSummary.plays.map((play) => (
                  <span
                    key={`${play.playerId}-${play.card.id}`}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-emerald-50"
                  >
                    {playerNameById(play.playerId)}: {formatCard(play.card)}
                  </span>
                ))}
              </div>
              {trickNextLead && (
                <div className="text-[clamp(11px,0.85vw,13px)] text-emerald-100/70">
                  Next lead: <span className="text-emerald-50">{trickNextLead}</span>
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={onAcknowledgeTrickResolution}
              className="bg-[#f2c879] text-[#2b1c07] hover:bg-[#f8d690]"
            >
              OK - Next trick
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmNewGameOpen} onOpenChange={setConfirmNewGameOpen}>
        <AlertDialogContent className="border-white/10 bg-[#0c1813] text-emerald-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new match?</AlertDialogTitle>
            <AlertDialogDescription className="text-emerald-100/70">
              This resets the match, clears all pips, and starts the round count back at 1.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-white/5 text-emerald-50 hover:bg-white/10">
              Keep Playing
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmNewGame} className="bg-[#f2c879] text-[#2b1c07] hover:bg-[#f8d690]">
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

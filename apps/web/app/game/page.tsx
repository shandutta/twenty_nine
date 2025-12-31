"use client"

import { useEffect, useMemo, useState } from "react"
import type { Card, Suit } from "@twentynine/engine"
import { GameTable } from "@/components/game/table"
import { GameSidebar } from "@/components/game/sidebar"
import { SettingsSheet } from "@/components/game/settings-sheet"
import { useGameController } from "@/components/game/use-game-controller"

const suitSymbols: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
}

const formatCard = (card: Card): string => `${card.rank}${suitSymbols[card.suit]}`

const formatCardList = (cards: Card[]): string =>
  cards.length === 0 ? "--" : cards.map(formatCard).join(", ")

export default function GamePage() {
  const {
    gameState,
    engineState,
    legalCardIds,
    onPlayCard,
    onNewGame,
    lastMove,
    botSettings,
    setBotEnabled,
    setBotDifficulty,
  } = useGameController()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [animationsEnabled, setAnimationsEnabled] = useState(true)
  const [autoPlay, setAutoPlay] = useState(false)
  const [coachEnabled, setCoachEnabled] = useState(false)
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachError, setCoachError] = useState<string | null>(null)
  const [coachResponse, setCoachResponse] = useState<string | null>(null)
  const [openRouterConfigured, setOpenRouterConfigured] = useState<boolean | null>(null)

  const playerLabel = useMemo(() => {
    return (player: number) => gameState.players[player]?.name ?? `P${player + 1}`
  }, [gameState.players])

  const lastMoveSummary = lastMove
    ? `${playerLabel(lastMove.action.player)} played ${formatCard(lastMove.action.card)}`
    : "No moves yet."

  const legalAlternatives = lastMove ? formatCardList(lastMove.legalMoves) : "--"

  const canRequestCoach =
    coachEnabled && Boolean(lastMove) && !coachLoading && openRouterConfigured !== false

  useEffect(() => {
    let isMounted = true
    const checkConfig = async () => {
      try {
        const response = await fetch("/api/openrouter")
        const data = (await response.json().catch(() => null)) as { configured?: boolean } | null
        if (isMounted) {
          setOpenRouterConfigured(Boolean(data?.configured))
        }
      } catch {
        if (isMounted) {
          setOpenRouterConfigured(false)
        }
      }
    }
    void checkConfig()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    setCoachResponse(null)
    setCoachError(null)
  }, [lastMove?.action, coachEnabled])

  const requestCoach = async () => {
    if (!coachEnabled || !lastMove) {
      return
    }
    if (openRouterConfigured === false) {
      setCoachError("Set OPENROUTER_API_KEY in apps/web/.env.local first.")
      return
    }
    setCoachLoading(true)
    setCoachError(null)
    setCoachResponse(null)

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
    }

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
      })

      const data = (await response.json().catch(() => null)) as
        | { error?: string; message?: { content?: string } }
        | null

      if (!response.ok) {
        setCoachError(data?.error ?? "OpenRouter request failed.")
        return
      }

      const content = data?.message?.content
      if (!content) {
        setCoachError("No response from coach.")
        return
      }
      setCoachResponse(content)
    } catch {
      setCoachError("Unable to reach OpenRouter.")
    } finally {
      setCoachLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <GameSidebar
        gameState={gameState}
        onNewGame={onNewGame}
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
      <main className="flex-1 overflow-hidden">
        <GameTable
          gameState={gameState}
          onPlayCard={onPlayCard}
          legalCardIds={legalCardIds}
          animationsEnabled={animationsEnabled}
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
      />
    </div>
  )
}

"use client"

import { useState } from "react"
import { GameTable } from "@/components/game/table"
import { GameSidebar } from "@/components/game/sidebar"
import { SettingsSheet } from "@/components/game/settings-sheet"
import { useGameController } from "@/components/game/use-game-controller"

export default function GamePage() {
  const { gameState, legalCardIds, onPlayCard, onNewGame } = useGameController()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [animationsEnabled, setAnimationsEnabled] = useState(true)
  const [autoPlay, setAutoPlay] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <GameSidebar gameState={gameState} onNewGame={onNewGame} onOpenSettings={() => setSettingsOpen(true)} />
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

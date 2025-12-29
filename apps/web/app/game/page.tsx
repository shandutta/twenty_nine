"use client"

import { useState } from "react"
import { GameTable } from "@/components/game/table"
import { GameSidebar } from "@/components/game/sidebar"
import { SettingsSheet } from "@/components/game/settings-sheet"

export type Suit = "hearts" | "diamonds" | "clubs" | "spades"
export type Rank = "J" | "9" | "A" | "10" | "K" | "Q" | "8" | "7"

export interface PlayingCard {
  suit: Suit
  rank: Rank
  id: string
}

export interface Team {
  id: "teamA" | "teamB"
  name: string
  players: string[] // player IDs
  tricksWon: number
  bid?: number
  bidWinner?: string
  gameScore: number // -6 to +6, where sign indicates red(+) or black(-) 6s
}

export interface Player {
  id: string
  name: string
  position: "bottom" | "left" | "top" | "right"
  cards: PlayingCard[]
  isCurrentPlayer: boolean
  teamId: "teamA" | "teamB"
}

export interface GameState {
  players: Player[]
  teams: {
    teamA: Team
    teamB: Team
  }
  trumpSuit: Suit | null
  trumpRevealed: boolean
  currentTrick: { playerId: string; card: PlayingCard }[]
  phase: "bidding" | "playing" | "finished"
  currentBid: number
  bidWinner: string | null
  roundNumber: number
}

const generateDeck = (): PlayingCard[] => {
  const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"]
  const ranks: Rank[] = ["J", "9", "A", "10", "K", "Q", "8", "7"]
  const deck: PlayingCard[] = []

  suits.forEach((suit) => {
    ranks.forEach((rank) => {
      deck.push({ suit, rank, id: `${suit}-${rank}` })
    })
  })

  return deck.sort(() => Math.random() - 0.5)
}

const dealCards = (deck: PlayingCard[]): PlayingCard[][] => {
  const hands: PlayingCard[][] = [[], [], [], []]
  deck.forEach((card, index) => {
    hands[index % 4].push(card)
  })
  return hands
}

const initialDeck = generateDeck()
const hands = dealCards(initialDeck)

const initialGameState: GameState = {
  players: [
    {
      id: "player1",
      name: "You",
      position: "bottom",
      cards: hands[0],
      isCurrentPlayer: true,
      teamId: "teamA", // You and North are Team A (across from each other)
    },
    {
      id: "player2",
      name: "West",
      position: "left",
      cards: hands[1],
      isCurrentPlayer: false,
      teamId: "teamB", // West and East are Team B
    },
    {
      id: "player3",
      name: "North",
      position: "top",
      cards: hands[2],
      isCurrentPlayer: false,
      teamId: "teamA", // Partner with You
    },
    {
      id: "player4",
      name: "East",
      position: "right",
      cards: hands[3],
      isCurrentPlayer: false,
      teamId: "teamB", // Partner with West
    },
  ],
  teams: {
    teamA: {
      id: "teamA",
      name: "You & North",
      players: ["player1", "player3"],
      tricksWon: 4,
      bid: 17,
      bidWinner: "player1",
      gameScore: 2, // 2 red 6s (winning)
    },
    teamB: {
      id: "teamB",
      name: "West & East",
      players: ["player2", "player4"],
      tricksWon: 4,
      gameScore: -1, // 1 black 6 (losing)
    },
  },
  trumpSuit: "hearts",
  trumpRevealed: false,
  currentTrick: [
    { playerId: "player2", card: { suit: "spades", rank: "K", id: "spades-K" } },
    { playerId: "player3", card: { suit: "spades", rank: "9", id: "spades-9" } },
    { playerId: "player4", card: { suit: "spades", rank: "Q", id: "spades-Q" } },
    { playerId: "player1", card: { suit: "spades", rank: "J", id: "spades-J" } },
  ],
  phase: "playing",
  currentBid: 17,
  bidWinner: "player1",
  roundNumber: 3,
}

export default function GamePage() {
  const [gameState, setGameState] = useState<GameState>(initialGameState)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [animationsEnabled, setAnimationsEnabled] = useState(true)
  const [autoPlay, setAutoPlay] = useState(false)

  const handlePlayCard = (card: PlayingCard) => {
    setGameState((prev) => ({
      ...prev,
      currentTrick: [...prev.currentTrick, { playerId: "player1", card }],
      players: prev.players.map((p) =>
        p.id === "player1" ? { ...p, cards: p.cards.filter((c) => c.id !== card.id) } : p,
      ),
    }))
  }

  const handleRevealTrump = () => {
    setGameState((prev) => ({ ...prev, trumpRevealed: true }))
  }

  const handleNewGame = () => {
    const newDeck = generateDeck()
    const newHands = dealCards(newDeck)
    setGameState({
      ...initialGameState,
      players: initialGameState.players.map((p, i) => ({
        ...p,
        cards: newHands[i],
      })),
      teams: {
        teamA: { ...initialGameState.teams.teamA, tricksWon: 0 },
        teamB: { ...initialGameState.teams.teamB, tricksWon: 0 },
      },
      currentTrick: [],
      trumpRevealed: false,
      roundNumber: gameState.roundNumber + 1,
    })
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <GameSidebar gameState={gameState} onNewGame={handleNewGame} onOpenSettings={() => setSettingsOpen(true)} />
      <main className="flex-1 overflow-hidden">
        <GameTable
          gameState={gameState}
          onPlayCard={handlePlayCard}
          onRevealTrump={handleRevealTrump}
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

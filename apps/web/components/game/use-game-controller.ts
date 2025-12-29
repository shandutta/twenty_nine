import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  chooseBotCard,
  createGameState,
  getLegalPlays,
  reduceGame,
} from "@twentynine/engine"
import type { Card, GameState as EngineState } from "@twentynine/engine"
import type { GameState, PlayingCard, Player, Team } from "./types"

type PlayerMeta = {
  id: string
  name: string
  position: Player["position"]
  teamId: Player["teamId"]
}

const PLAYER_META: PlayerMeta[] = [
  { id: "player1", name: "You", position: "bottom", teamId: "teamA" },
  { id: "player2", name: "West", position: "left", teamId: "teamB" },
  { id: "player3", name: "North", position: "top", teamId: "teamA" },
  { id: "player4", name: "East", position: "right", teamId: "teamB" },
]

const HUMAN_PLAYER = 0

const cardId = (card: Card) => `${card.suit}-${card.rank}`

const toPlayingCard = (card: Card): PlayingCard => ({
  suit: card.suit,
  rank: card.rank,
  id: cardId(card),
})

const createUiState = (state: EngineState, roundNumber: number): GameState => {
  const players: Player[] = PLAYER_META.map((meta, index) => ({
    ...meta,
    cards: state.hands[index].map(toPlayingCard),
    isCurrentPlayer: state.currentPlayer === index,
  }))

  const teamA: Team = {
    id: "teamA",
    name: "You & North",
    players: [PLAYER_META[0].id, PLAYER_META[2].id],
    tricksWon: state.tricksWon[0],
    bid: state.bidTarget,
    bidWinner: state.bidderTeam === 0 ? PLAYER_META[0].id : PLAYER_META[1].id,
    gameScore: 0,
    handPoints: state.points[0],
  }

  const teamB: Team = {
    id: "teamB",
    name: "West & East",
    players: [PLAYER_META[1].id, PLAYER_META[3].id],
    tricksWon: state.tricksWon[1],
    gameScore: 0,
    handPoints: state.points[1],
  }

  const currentTrick = state.trick.plays.map((play) => ({
    playerId: PLAYER_META[play.player].id,
    card: toPlayingCard(play.card),
  }))

  return {
    players,
    teams: { teamA, teamB },
    trumpSuit: state.trumpSuit,
    trumpRevealed: state.trumpRevealed,
    currentTrick,
    phase: state.phase === "playing" ? "playing" : "finished",
    currentBid: state.bidTarget,
    bidWinner: state.bidderTeam === 0 ? PLAYER_META[0].id : PLAYER_META[1].id,
    roundNumber,
    trickNumber: state.trickNumber,
    currentPlayerId: PLAYER_META[state.currentPlayer].id,
    log: state.log,
  }
}

export const useGameController = () => {
  const [roundNumber, setRoundNumber] = useState(1)
  const [engineState, setEngineState] = useState<EngineState>(() =>
    createGameState({ seed: Date.now() }),
  )

  const botTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dispatch = useCallback((action: Parameters<typeof reduceGame>[1]) => {
    setEngineState((prev) => reduceGame(prev, action))
  }, [])

  const legalCards = useMemo(() => {
    const hand = engineState.hands[HUMAN_PLAYER]
    return getLegalPlays(hand, engineState.trick).map(cardId)
  }, [engineState])

  const handlePlayCard = useCallback(
    (card: PlayingCard) => {
      if (engineState.phase !== "playing") return
      if (engineState.currentPlayer !== HUMAN_PLAYER) return
      if (!legalCards.includes(card.id)) return

      dispatch({
        type: "playCard",
        player: HUMAN_PLAYER,
        card: { suit: card.suit, rank: card.rank },
      })
    },
    [dispatch, engineState, legalCards],
  )

  const handleNewGame = useCallback(() => {
    setEngineState(createGameState({ seed: Date.now() }))
    setRoundNumber((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (engineState.phase !== "playing") return
    if (engineState.currentPlayer === HUMAN_PLAYER) return

    if (botTimeout.current) {
      clearTimeout(botTimeout.current)
    }

    botTimeout.current = setTimeout(() => {
      const player = engineState.currentPlayer
      const hand = engineState.hands[player]
      const card = chooseBotCard({ hand, trick: engineState.trick })

      dispatch({ type: "playCard", player, card })
    }, 450)

    return () => {
      if (botTimeout.current) {
        clearTimeout(botTimeout.current)
      }
      botTimeout.current = null
    }
  }, [dispatch, engineState])

  const gameState = useMemo(() => createUiState(engineState, roundNumber), [engineState, roundNumber])

  return {
    gameState,
    legalCardIds: legalCards,
    onPlayCard: handlePlayCard,
    onNewGame: handleNewGame,
  }
}

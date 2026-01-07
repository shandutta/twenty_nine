import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {
  cardPoints,
  chooseBotCard,
  createGameState,
  getLegalPlays,
  leadSuit,
  reduceGame,
  teamForPlayer,
} from "@twentynine/engine";
import type { Card, GameAction, GameState, Suit } from "@twentynine/engine";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3100";
const STORAGE_KEY = "twentynine:mobile:state:v1";
const STORAGE_VERSION = 1;
const AUTH_KEY = "twentynine:mobile:auth:v1";
const DEVICE_KEY = "twentynine:mobile:device:v1";
const PUSH_KEY = "twentynine:mobile:push:v1";
const HUMAN_PLAYER = 0;
const BOT_THINK_DELAY_MS = 450;
const AUTH_REFRESH_SKEW_MS = 60_000;

type PersistedState = {
  version: typeof STORAGE_VERSION;
  engineState: GameState;
};

type AuthState = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type LastMoveInfo = {
  action: Extract<GameAction, { type: "playCard" }>;
  legalMoves: Card[];
};

const PLAYER_LABELS = ["You", "West", "North", "East"] as const;
const TEAM_LABELS = ["Team A", "Team B"] as const;

const SUIT_SHORT: Record<Suit, string> = {
  clubs: "C",
  diamonds: "D",
  hearts: "H",
  spades: "S",
};

const BOT_MODELS = ["openai/gpt-5.2-chat", "google/gemini-3-pro-preview", "anthropic/claude-opus-4.5"];

const BOT_TEMPERATURE = 0.3;

const cardLabel = (card: Card) => `${card.rank}${SUIT_SHORT[card.suit]}`;
const cardLongLabel = (card: Card) => `${card.rank} of ${card.suit}`;

const normalizeSuit = (value: string): Suit | null => {
  const lowered = value.trim().toLowerCase();
  if (["clubs", "club", "c"].includes(lowered)) return "clubs";
  if (["diamonds", "diamond", "d"].includes(lowered)) return "diamonds";
  if (["hearts", "heart", "h"].includes(lowered)) return "hearts";
  if (["spades", "spade", "s"].includes(lowered)) return "spades";
  return null;
};

const normalizeRank = (value: string): Card["rank"] | null => {
  const upper = value.trim().toUpperCase();
  const allowed: Card["rank"][] = ["7", "8", "9", "10", "J", "Q", "K", "A"];
  return allowed.includes(upper as Card["rank"]) ? (upper as Card["rank"]) : null;
};

const extractJson = (text: string): Record<string, unknown> | null => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const parseCardFromText = (text: string, legalMoves: Card[]): Card | null => {
  const json = extractJson(text);
  if (json) {
    const rank = typeof json.rank === "string" ? normalizeRank(json.rank) : null;
    const suit = typeof json.suit === "string" ? normalizeSuit(json.suit) : null;
    if (rank && suit) {
      const match = legalMoves.find((card) => card.rank === rank && card.suit === suit);
      if (match) return match;
    }
  }

  const regex = /(10|[7-9]|J|Q|K|A)\s*(clubs|diamonds|hearts|spades|[CDHS])/i;
  const match = text.match(regex);
  if (!match) return null;
  const rank = normalizeRank(match[1]);
  const suit = normalizeSuit(match[2]);
  if (!rank || !suit) return null;
  return legalMoves.find((card) => card.rank === rank && card.suit === suit) ?? null;
};

const readJsonStorage = async <T,>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJsonStorage = async (key: string, value: unknown) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore persistence errors
  }
};

const readSecureJson = async <T,>(key: string): Promise<T | null> => {
  try {
    if (Platform.OS !== "web") {
      const raw = await SecureStore.getItemAsync(key);
      if (raw) return JSON.parse(raw) as T;
    }
  } catch {
    // fall through
  }
  return readJsonStorage<T>(key);
};

const writeSecureJson = async (key: string, value: unknown) => {
  const serialized = JSON.stringify(value);
  try {
    if (Platform.OS !== "web") {
      await SecureStore.setItemAsync(key, serialized);
      return;
    }
  } catch {
    // fall back to AsyncStorage
  }
  await AsyncStorage.setItem(key, serialized);
};

const getDeviceId = async (): Promise<string> => {
  const stored = await readJsonStorage<string>(DEVICE_KEY);
  if (typeof stored === "string" && stored.length > 8) return stored;
  const bytes = await Crypto.getRandomBytesAsync(16);
  const id = Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  await writeJsonStorage(DEVICE_KEY, id);
  return id;
};

const buildBotPrompt = (state: GameState, legalMoves: Card[]): string => {
  const player = state.currentPlayer;
  const hand = state.hands[player] ?? [];
  const lead = leadSuit(state.trick) ?? "none";
  const trumpLabel = state.trumpSuit ?? "no trump";
  const currentTrick = state.trick.plays.length
    ? state.trick.plays.map((play) => `${PLAYER_LABELS[play.player]}:${cardLongLabel(play.card)}`).join(", ")
    : "none";
  const legalMovesWithPoints = legalMoves
    .map((card) => `{"rank":"${card.rank}","suit":"${card.suit}","points":${cardPoints(card)}}`)
    .join(", ");

  return [
    'You are an expert 29 card game bot. Return JSON only with keys "rank" and "suit".',
    "Always choose from the provided legal moves.",
    "",
    "Strategy guardrails:",
    "- Preserve high-value cards (J=3, 9=2, A=1, 10=1) early unless winning a trick or forced to slough.",
    "- Avoid dumping the 9 or J early when a lower legal card exists and the trick is not guaranteed.",
    "- If it is early (tricks 1-3) and a 0-point legal card exists, do not play a point card unless it clearly wins the trick.",
    "- If you are unlikely to win the current trick, favor the lowest-point legal card.",
    "- Prefer winning with the lowest necessary card; avoid overtrumping.",
    "",
    `Player: ${PLAYER_LABELS[player]}.`,
    `Your team: ${TEAM_LABELS[teamForPlayer(player)]}.`,
    `Trick ${state.trickNumber + 1} of 8. Lead suit: ${lead}.`,
    `Trump: ${state.trumpRevealed ? trumpLabel : "hidden"}.`,
    `Score: Team A ${state.points[0]} pts, Team B ${state.points[1]} pts.`,
    `Current trick plays: ${currentTrick}.`,
    `Your hand: ${hand.map(cardLongLabel).join(", ")}.`,
    `Legal moves: ${legalMovesWithPoints}.`,
    "",
    "Respond with JSON only.",
  ].join("\n");
};

const buildCoachPrompt = (state: GameState, lastMove: LastMoveInfo): string => {
  const player = lastMove.action.player;
  const hand = state.hands[player] ?? [];
  const currentTrick = state.trick.plays.length
    ? state.trick.plays.map((play) => `${PLAYER_LABELS[play.player]}:${cardLongLabel(play.card)}`).join(", ")
    : "none";
  const legalMoves = lastMove.legalMoves.map(cardLongLabel).join(", ");
  const trumpLabel = state.trumpSuit ?? "no trump";

  return [
    "You are a 29 card game coach for the human player.",
    "Use ONLY the visible info provided (current trick, last trick, score, trump visibility, and the player's visible hand).",
    "Do NOT mention or infer hidden cards, unrevealed trump, or speculate about opponents' hands.",
    "When it is the player's turn, give a 1-2 sentence recap plus 1-2 legal card suggestions from legalMoves.",
    "Be concise.",
    "",
    `Player: ${PLAYER_LABELS[player]}.`,
    `Last move: ${cardLongLabel(lastMove.action.card)}.`,
    `Your hand: ${hand.map(cardLongLabel).join(", ")}.`,
    `Legal moves at that time: ${legalMoves}.`,
    `Current trick: ${currentTrick}.`,
    `Trump: ${state.trumpRevealed ? trumpLabel : "hidden"}.`,
    `Score: Team A ${state.points[0]} pts, Team B ${state.points[1]} pts.`,
    "",
    "Respond with plain text (no JSON).",
  ].join("\n");
};

export default function App() {
  const [engineState, setEngineState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [llmBusy, setLlmBusy] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachResponse, setCoachResponse] = useState<string | null>(null);
  const [lastHumanMove, setLastHumanMove] = useState<LastMoveInfo | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const engineRef = useRef<GameState | null>(null);
  const botBusyRef = useRef(false);
  const authRef = useRef<AuthState | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    engineRef.current = engineState;
  }, [engineState]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadState = async () => {
      const persisted = await readJsonStorage<PersistedState>(STORAGE_KEY);
      const persistedState =
        persisted?.version === STORAGE_VERSION &&
        persisted.engineState &&
        (persisted.engineState.phase === "playing" || persisted.engineState.phase === "hand-complete")
          ? persisted.engineState
          : null;
      if (mounted && persistedState) {
        setEngineState(persistedState);
      } else if (mounted) {
        setEngineState(
          createGameState({
            seed: Date.now(),
            phase: "playing",
            bidderPlayer: HUMAN_PLAYER,
            bidderTeam: 0,
          })
        );
      }
      if (mounted) setIsLoading(false);
    };
    loadState();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const loadAuth = async () => {
      const stored = await readSecureJson<AuthState>(AUTH_KEY);
      authRef.current = stored;
    };
    loadAuth().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!engineState) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      writeJsonStorage(STORAGE_KEY, { version: STORAGE_VERSION, engineState }).catch(() => undefined);
    }, 250);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [engineState]);

  const saveAuthState = useCallback(async (state: AuthState | null) => {
    authRef.current = state;
    if (state) {
      await writeSecureJson(AUTH_KEY, state);
    } else {
      await AsyncStorage.removeItem(AUTH_KEY);
    }
  }, []);

  const fetchAnonymousToken = useCallback(async () => {
    const deviceId = await getDeviceId();
    const response = await fetch(`${API_BASE_URL}/api/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });
    if (!response.ok) {
      throw new Error("Auth failed.");
    }
    const data = (await response.json().catch(() => null)) as {
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
    } | null;
    if (!data?.accessToken || !data?.refreshToken || !data?.expiresIn) {
      throw new Error("Auth response invalid.");
    }
    const expiresAt = Date.now() + data.expiresIn * 1000;
    return { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresAt };
  }, []);

  const refreshAccessToken = useCallback(async (refreshToken: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json().catch(() => null)) as {
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
    } | null;
    if (!data?.accessToken || !data?.refreshToken || !data?.expiresIn) {
      return null;
    }
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + data.expiresIn * 1000,
    };
  }, []);

  const ensureAccessToken = useCallback(async () => {
    try {
      const current = authRef.current;
      if (current && current.expiresAt - AUTH_REFRESH_SKEW_MS > Date.now()) {
        return current.accessToken;
      }
      if (current?.refreshToken) {
        const refreshed = await refreshAccessToken(current.refreshToken);
        if (refreshed) {
          await saveAuthState(refreshed);
          setAuthError(null);
          return refreshed.accessToken;
        }
      }
      const fresh = await fetchAnonymousToken();
      await saveAuthState(fresh);
      setAuthError(null);
      return fresh.accessToken;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Auth failed.");
      return null;
    }
  }, [fetchAnonymousToken, refreshAccessToken, saveAuthState]);

  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await ensureAccessToken();
      if (!token) {
        throw new Error("Auth unavailable.");
      }
      const headers = new Headers(init.headers ?? {});
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      headers.set("Authorization", `Bearer ${token}`);
      return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    },
    [ensureAccessToken]
  );

  const registerForPush = useCallback(async () => {
    if (!Device.isDevice) return;
    try {
      const stored = await readJsonStorage<string>(PUSH_KEY);
      if (stored) return;
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") return;
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const expoPushToken = tokenData.data;
      const response = await apiFetch("/api/push/register", {
        method: "POST",
        body: JSON.stringify({
          expoPushToken,
          platform: Platform.OS,
        }),
      });
      if (response.ok) {
        await writeJsonStorage(PUSH_KEY, expoPushToken);
      }
    } catch {
      // ignore push registration errors
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!isOnline) return;
    registerForPush().catch(() => undefined);
  }, [isOnline, registerForPush]);

  const requestLLMMove = useCallback(
    async (state: GameState, legalMoves: Card[]) => {
      const prompt = buildBotPrompt(state, legalMoves);
      for (const model of BOT_MODELS) {
        try {
          const response = await apiFetch("/api/mobile/openrouter", {
            method: "POST",
            body: JSON.stringify({
              model,
              temperature: BOT_TEMPERATURE,
              trace: {
                source: "bot",
                matchRound: state.matchRound,
                trickNumber: state.trickNumber + 1,
                phase: state.phase,
                playerId: String(state.currentPlayer),
                playerName: PLAYER_LABELS[state.currentPlayer],
                gameSeed: state.seed,
                turnId: state.log.length,
              },
              messages: [
                {
                  role: "system",
                  content: "You choose legal cards for a 29 card game. Respond with JSON only.",
                },
                { role: "user", content: prompt },
              ],
            }),
          });
          if (!response.ok) {
            continue;
          }
          const data = (await response.json().catch(() => null)) as { message?: { content?: string } } | null;
          const content = data?.message?.content;
          if (!content) continue;
          const parsed = parseCardFromText(content, legalMoves);
          if (parsed) return parsed;
        } catch {
          continue;
        }
      }
      return null;
    },
    [apiFetch]
  );

  const applyAction = useCallback(
    (action: GameAction) => {
      const current = engineRef.current;
      if (!current) return;
      try {
        const nextState = reduceGame(current, action);
        engineRef.current = nextState;
        setEngineState(nextState);
        if (action.type === "playCard" && action.player === HUMAN_PLAYER) {
          const legalMoves = getLegalPlays(current.hands[action.player], current.trick, {
            trumpSuit: current.trumpSuit,
            trumpRevealed: current.trumpRevealed,
            trumpFromSeventh: current.trumpFromSeventh,
          });
          setLastHumanMove({ action, legalMoves });
        }
      } catch (error) {
        setLlmError(error instanceof Error ? error.message : "Invalid move.");
      }
    },
    [setEngineState]
  );

  const resetHand = useCallback(() => {
    const prev = engineRef.current;
    const seed = prev?.seed ?? Date.now();
    const dealer = prev ? (prev.dealer + 1) % 4 : 0;
    const config = prev?.config;
    const nextState = createGameState({
      seed: seed + 1,
      dealer,
      phase: "playing",
      bidderPlayer: HUMAN_PLAYER,
      bidderTeam: 0,
      bidTarget: config?.minBid,
      config,
    });
    engineRef.current = nextState;
    setEngineState(nextState);
    botBusyRef.current = false;
    setLlmBusy(false);
    setLastHumanMove(null);
    setCoachResponse(null);
    setLlmError(null);
  }, []);

  useEffect(() => {
    if (!engineState) return;
    if (engineState.phase !== "playing") return;
    if (engineState.currentPlayer === HUMAN_PLAYER) return;
    if (!isOnline) return;
    if (botBusyRef.current) return;

    const expectedTurn = engineState.log.length;
    botBusyRef.current = true;
    setLlmBusy(true);
    setLlmError(null);

    const timer = setTimeout(async () => {
      try {
        const state = engineRef.current;
        if (!state) return;
        if (state.log.length !== expectedTurn) return;
        const hand = state.hands[state.currentPlayer] ?? [];
        const legalMoves = getLegalPlays(hand, state.trick, {
          trumpSuit: state.trumpSuit,
          trumpRevealed: state.trumpRevealed,
          trumpFromSeventh: state.trumpFromSeventh,
        });
        const llmCard = await requestLLMMove(state, legalMoves);
          const chosen =
            llmCard ??
            chooseBotCard({
              hand,
              trick: state.trick,
              player: state.currentPlayer,
              trumpSuit: state.trumpSuit,
              trumpRevealed: state.trumpRevealed,
              trumpFromSeventh: state.trumpFromSeventh,
            });
        if (chosen) {
          applyAction({ type: "playCard", player: state.currentPlayer, card: chosen });
        }
      } catch (error) {
        setLlmError(error instanceof Error ? error.message : "Bot failed to move.");
      } finally {
        botBusyRef.current = false;
        setLlmBusy(false);
      }
    }, BOT_THINK_DELAY_MS);

    return () => clearTimeout(timer);
  }, [engineState, isOnline, applyAction, requestLLMMove]);

  const handleCoach = useCallback(async () => {
    if (!engineState || !lastHumanMove) {
      Alert.alert("Coach", "Play a card first so the coach can review your move.");
      return;
    }
    if (!isOnline) {
      Alert.alert("Coach", "Connect to the internet to request coaching.");
      return;
    }
    setCoachLoading(true);
    setCoachResponse(null);
    try {
      const prompt = buildCoachPrompt(engineState, lastHumanMove);
      const response = await apiFetch("/api/mobile/openrouter", {
        method: "POST",
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          temperature: 0.2,
          trace: { source: "coach", matchRound: engineState.matchRound },
          messages: [
            {
              role: "system",
              content: "You coach a 29 card game player. Be concise and concrete.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: { content?: string } } | null;
      const content = data?.message?.content?.trim();
      if (content) {
        setCoachResponse(content);
      } else {
        setCoachResponse("No response from coach.");
      }
    } catch {
      setCoachResponse("Unable to reach coach.");
    } finally {
      setCoachLoading(false);
    }
  }, [apiFetch, engineState, isOnline, lastHumanMove]);

  const currentPlayer = engineState?.currentPlayer ?? 0;
  const isHumanTurn = currentPlayer === HUMAN_PLAYER;
  const humanHand = engineState?.hands[HUMAN_PLAYER] ?? [];
  const legalMoves = useMemo(() => {
    if (!engineState) return [];
    return getLegalPlays(humanHand, engineState.trick, {
      trumpSuit: engineState.trumpSuit,
      trumpRevealed: engineState.trumpRevealed,
      trumpFromSeventh: engineState.trumpFromSeventh,
    });
  }, [engineState, humanHand]);
  const legalKeys = new Set(legalMoves.map(cardLabel));

  if (isLoading || !engineState) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color="#f2c879" />
        <Text style={styles.loadingText}>Loading game…</Text>
      </SafeAreaView>
    );
  }

  const offlineBlocked = !isOnline && !isHumanTurn;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>TwentyNine</Text>
        <Text style={styles.subtitle}>Trick {engineState.trickNumber + 1} / 8</Text>
      </View>

      {!isOnline && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Offline: bots require internet to play.</Text>
        </View>
      )}

      {authError && (
        <View style={styles.bannerError}>
          <Text style={styles.bannerText}>Auth error: {authError}</Text>
        </View>
      )}

      <View style={styles.scoreRow}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Team A</Text>
          <Text style={styles.scoreValue}>{engineState.points[0]}</Text>
        </View>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Team B</Text>
          <Text style={styles.scoreValue}>{engineState.points[1]}</Text>
        </View>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Trump</Text>
          <Text style={styles.scoreValue}>
            {engineState.trumpRevealed && engineState.trumpSuit ? SUIT_SHORT[engineState.trumpSuit] : "?"}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current trick</Text>
        <View style={styles.trickPlays}>
          {engineState.trick.plays.length === 0 && <Text style={styles.mutedText}>No cards yet.</Text>}
          {engineState.trick.plays.map((play) => (
            <View key={`${play.player}-${cardLabel(play.card)}`} style={styles.trickPlay}>
              <Text style={styles.trickPlayer}>{PLAYER_LABELS[play.player]}</Text>
              <Text style={styles.trickCard}>{cardLabel(play.card)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.turnText}>
          {isHumanTurn ? "Your turn." : `${PLAYER_LABELS[currentPlayer]}'s turn.`}
          {llmBusy && " (thinking…)"}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your hand</Text>
        <View style={styles.handGrid}>
          {humanHand.map((card) => {
            const key = cardLabel(card);
            const isLegal = legalKeys.has(key);
            const disabled = !isHumanTurn || !isLegal || offlineBlocked;
            return (
              <Pressable
                key={key}
                style={[styles.cardButton, disabled && styles.cardButtonDisabled, isLegal && styles.cardButtonLegal]}
                onPress={() => applyAction({ type: "playCard", player: HUMAN_PLAYER, card })}
                disabled={disabled}
              >
                <Text style={styles.cardText}>{cardLabel(card)}</Text>
                <Text style={styles.cardSub}>{cardPoints(card)} pts</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.primaryButton} onPress={resetHand}>
          <Text style={styles.primaryButtonText}>New hand</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleCoach} disabled={coachLoading}>
          <Text style={styles.secondaryButtonText}>{coachLoading ? "Coaching…" : "Coach last move"}</Text>
        </Pressable>
      </View>

      {coachResponse && (
        <View style={styles.coachCard}>
          <Text style={styles.sectionTitle}>Coach</Text>
          <Text style={styles.coachText}>{coachResponse}</Text>
        </View>
      )}

      {llmError && (
        <View style={styles.bannerError}>
          <Text style={styles.bannerText}>{llmError}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Log</Text>
        <ScrollView style={styles.log} contentContainerStyle={styles.logContent}>
          {engineState.log.slice(-8).map((line, index) => (
            <Text key={`${index}-${line}`} style={styles.logText}>
              {line}
            </Text>
          ))}
        </ScrollView>
      </View>

      {offlineBlocked && (
        <View style={styles.blocker}>
          <Text style={styles.blockerText}>Connect to the internet to let bots play.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1310",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  loading: {
    flex: 1,
    backgroundColor: "#0b1310",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#e6d7b8",
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f2c879",
  },
  subtitle: {
    fontSize: 14,
    color: "#a7b3a6",
  },
  banner: {
    backgroundColor: "#2f3c2b",
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
  },
  bannerError: {
    backgroundColor: "#3a1f1f",
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
  },
  bannerText: {
    color: "#f2e6c7",
    fontSize: 12,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: "#121c17",
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 4,
  },
  scoreLabel: {
    color: "#a7b3a6",
    fontSize: 11,
    textTransform: "uppercase",
  },
  scoreValue: {
    color: "#f2c879",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    color: "#f2e6c7",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
  },
  trickPlays: {
    backgroundColor: "#111a16",
    borderRadius: 10,
    padding: 10,
  },
  trickPlay: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  trickPlayer: {
    color: "#c7c2b2",
  },
  trickCard: {
    color: "#f2c879",
    fontWeight: "600",
  },
  turnText: {
    marginTop: 6,
    color: "#a7b3a6",
  },
  mutedText: {
    color: "#7f8a7a",
  },
  handGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cardButton: {
    backgroundColor: "#16221c",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 72,
    alignItems: "center",
  },
  cardButtonLegal: {
    borderColor: "#f2c879",
    borderWidth: 1,
  },
  cardButtonDisabled: {
    opacity: 0.4,
  },
  cardText: {
    color: "#f2e6c7",
    fontSize: 16,
    fontWeight: "700",
  },
  cardSub: {
    color: "#a7b3a6",
    fontSize: 11,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#f2c879",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#0b1310",
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#1b261f",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#f2e6c7",
    fontWeight: "600",
  },
  coachCard: {
    marginTop: 12,
    backgroundColor: "#121c17",
    borderRadius: 10,
    padding: 10,
  },
  coachText: {
    color: "#e6d7b8",
    fontSize: 14,
    lineHeight: 20,
  },
  log: {
    maxHeight: 130,
    backgroundColor: "#0f1713",
    borderRadius: 8,
    padding: 8,
  },
  logContent: {
    gap: 6,
  },
  logText: {
    color: "#95a295",
    fontSize: 12,
  },
  blocker: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  blockerText: {
    color: "#f2e6c7",
    fontSize: 16,
    textAlign: "center",
  },
});

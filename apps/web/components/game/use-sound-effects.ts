"use client";

import { useCallback, useEffect, useRef } from "react";

type SoundEffect = "card" | "shuffle" | "deal" | "bid" | "pass" | "trump" | "trumpReveal" | "trickWin" | "royals";

const EFFECT_LEVELS: Record<SoundEffect, number> = {
  card: 0.28,
  shuffle: 0.35,
  deal: 0.22,
  bid: 0.25,
  pass: 0.2,
  trump: 0.32,
  trumpReveal: 0.3,
  trickWin: 0.36,
  royals: 0.34,
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const createNoiseBuffer = (ctx: AudioContext, seconds = 1): AudioBuffer => {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
};

const mapLogEntry = (entry: string): SoundEffect | null => {
  const lowered = entry.toLowerCase();
  if (lowered.includes("played")) return "card";
  if (lowered.includes("bids")) return "bid";
  if (lowered.includes("passes")) return "pass";
  if (lowered.includes("bidding ends") || lowered.includes("bidding won")) return "bid";
  if (lowered.includes("trump chosen") || lowered.includes("trump set")) return "trump";
  if (lowered.includes("trump revealed")) return "trumpReveal";
  if (lowered.includes("royals declared")) return "royals";
  if (lowered.includes("trick") && lowered.includes("won by")) return "trickWin";
  if (lowered.includes("first four cards dealt") || lowered.includes("remaining cards dealt")) return "deal";
  if (lowered.includes("redealing")) return "shuffle";
  return null;
};

type SoundEngine = {
  ctx: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
};

export function useSoundEffects({
  enabled,
  volume,
  log,
  roundNumber,
}: {
  enabled: boolean;
  volume: number;
  log: string[];
  roundNumber: number;
}) {
  const engineRef = useRef<SoundEngine | null>(null);
  const volumeRef = useRef(volume);
  const enabledRef = useRef(enabled);
  const logIndexRef = useRef<number | null>(null);
  const roundRef = useRef<number | null>(null);

  useEffect(() => {
    volumeRef.current = volume;
    if (engineRef.current) {
      engineRef.current.master.gain.value = clamp(volume / 100, 0, 1);
    }
  }, [volume]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const getEngine = useCallback((): SoundEngine => {
    if (engineRef.current) return engineRef.current;
    const AudioContextConstructor =
      window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextConstructor();
    const master = ctx.createGain();
    master.gain.value = clamp(volumeRef.current / 100, 0, 1);
    master.connect(ctx.destination);
    const noise = createNoiseBuffer(ctx);
    engineRef.current = { ctx, master, noise };
    return engineRef.current;
  }, []);

  const unlockAudio = useCallback(() => {
    if (!enabledRef.current) return;
    const engine = getEngine();
    if (engine.ctx.state !== "running") {
      void engine.ctx.resume();
    }
  }, [getEngine]);

  useEffect(() => {
    if (!enabled) return;
    const handlePointer = () => unlockAudio();
    window.addEventListener("pointerdown", handlePointer, { once: true });
    window.addEventListener("keydown", handlePointer, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handlePointer);
    };
  }, [enabled, unlockAudio]);

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        void engineRef.current.ctx.close();
        engineRef.current = null;
      }
    };
  }, []);

  const play = useCallback(
    (type: SoundEffect) => {
      if (!enabledRef.current) return;
      if (volumeRef.current <= 0) return;
      const engine = getEngine();
      const ctx = engine.ctx;
      if (ctx.state !== "running") {
        void ctx.resume();
      }
      const now = ctx.currentTime;
      const level = EFFECT_LEVELS[type] ?? 0.2;

      const playNoise = (
        duration: number,
        options: { type: BiquadFilterType; freq: number; q?: number; gain?: number; start?: number }
      ) => {
        const source = ctx.createBufferSource();
        source.buffer = engine.noise;
        const filter = ctx.createBiquadFilter();
        filter.type = options.type;
        filter.frequency.setValueAtTime(options.freq, now + (options.start ?? 0));
        filter.Q.value = options.q ?? 0.7;
        const gain = ctx.createGain();
        const startTime = now + (options.start ?? 0);
        const peak = level * (options.gain ?? 1);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(peak, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(engine.master);
        source.start(startTime);
        source.stop(startTime + duration + 0.02);
      };

      const playTone = (
        freq: number,
        duration: number,
        options: { type?: OscillatorType; gain?: number; start?: number; endFreq?: number }
      ) => {
        const osc = ctx.createOscillator();
        osc.type = options.type ?? "sine";
        const startTime = now + (options.start ?? 0);
        osc.frequency.setValueAtTime(freq, startTime);
        if (options.endFreq) {
          osc.frequency.exponentialRampToValueAtTime(options.endFreq, startTime + duration);
        }
        const gain = ctx.createGain();
        const peak = level * (options.gain ?? 1);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(peak, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        osc.connect(gain);
        gain.connect(engine.master);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
      };

      switch (type) {
        case "card": {
          playNoise(0.14, { type: "bandpass", freq: 1400, gain: 0.7 });
          playTone(180, 0.12, { type: "triangle", gain: 0.25, endFreq: 110 });
          break;
        }
        case "deal": {
          playNoise(0.1, { type: "highpass", freq: 900, gain: 0.55 });
          break;
        }
        case "shuffle": {
          playNoise(0.5, { type: "lowpass", freq: 1600, q: 0.4, gain: 0.8 });
          playNoise(0.3, { type: "bandpass", freq: 700, gain: 0.35, start: 0.12 });
          break;
        }
        case "bid": {
          playTone(420, 0.08, { gain: 0.7 });
          playTone(620, 0.1, { gain: 0.6, start: 0.08 });
          break;
        }
        case "pass": {
          playTone(170, 0.12, { type: "sine", gain: 0.7, endFreq: 110 });
          break;
        }
        case "trump": {
          playTone(260, 0.4, { type: "sawtooth", gain: 0.7, endFreq: 760 });
          playTone(520, 0.25, { type: "triangle", gain: 0.35, start: 0.1 });
          break;
        }
        case "trumpReveal": {
          playTone(880, 0.12, { type: "triangle", gain: 0.7 });
          playTone(1180, 0.16, { type: "sine", gain: 0.5, start: 0.05 });
          break;
        }
        case "trickWin": {
          playTone(330, 0.25, { type: "sine", gain: 0.6 });
          playTone(440, 0.25, { type: "sine", gain: 0.6, start: 0.02 });
          playTone(550, 0.25, { type: "sine", gain: 0.5, start: 0.04 });
          break;
        }
        case "royals": {
          playTone(700, 0.1, { type: "triangle", gain: 0.6 });
          playTone(920, 0.1, { type: "triangle", gain: 0.55, start: 0.06 });
          playTone(1180, 0.14, { type: "sine", gain: 0.5, start: 0.12 });
          break;
        }
        default:
          break;
      }
    },
    [getEngine]
  );

  useEffect(() => {
    if (roundRef.current === null) {
      roundRef.current = roundNumber;
      return;
    }
    if (roundNumber !== roundRef.current) {
      play("shuffle");
      roundRef.current = roundNumber;
    }
  }, [roundNumber, play]);

  useEffect(() => {
    if (!enabled) {
      logIndexRef.current = log.length;
      return;
    }
    if (logIndexRef.current === null) {
      logIndexRef.current = log.length;
      return;
    }
    if (log.length <= logIndexRef.current) {
      logIndexRef.current = log.length;
      return;
    }
    const newEntries = log.slice(logIndexRef.current);
    for (const entry of newEntries) {
      const effect = mapLogEntry(entry);
      if (effect) {
        play(effect);
      }
    }
    logIndexRef.current = log.length;
  }, [enabled, log, play]);
}

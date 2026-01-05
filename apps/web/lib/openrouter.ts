import { NextResponse } from "next/server";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type OpenRouterMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

type OpenRouterReasoning = {
  effort?: "xhigh" | "high" | "medium" | "low" | "minimal" | "none";
  max_tokens?: number;
  exclude?: boolean;
  enabled?: boolean;
};

type OpenRouterRequest = {
  messages: OpenRouterMessage[];
  model?: string;
  temperature?: number;
  reasoning?: OpenRouterReasoning;
  include_reasoning?: boolean;
  trace?: OpenRouterTrace;
};

type OpenRouterTrace = {
  source?: "bot" | "coach" | "other";
  matchRound?: number;
  trickNumber?: number;
  phase?: string;
  playerId?: string;
  playerName?: string;
  gameSeed?: number;
  turnId?: number;
};

const isMessage = (value: unknown): value is OpenRouterMessage => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const message = value as OpenRouterMessage;
  return typeof message.role === "string" && typeof message.content === "string";
};

const toNumber = (value: unknown): number | null => {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const extractCostUsd = (usage: Record<string, unknown> | null): number | null => {
  if (!usage) return null;
  const candidates = ["total_cost", "totalCost", "cost", "cost_usd", "total_cost_usd"];
  for (const key of candidates) {
    const value = toNumber(usage[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
};

const extractReasoningText = (message: unknown, maxChars: number): string | null => {
  if (!message || typeof message !== "object") return null;
  const entry = message as { reasoning?: unknown; reasoning_details?: unknown };
  if (typeof entry.reasoning === "string" && entry.reasoning.trim()) {
    const trimmed = entry.reasoning.trim();
    return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}...` : trimmed;
  }
  if (!Array.isArray(entry.reasoning_details)) {
    return null;
  }
  const parts: string[] = [];
  for (const detail of entry.reasoning_details) {
    if (!detail || typeof detail !== "object") continue;
    const detailEntry = detail as { type?: string; summary?: string; text?: string };
    if (detailEntry.type === "reasoning.summary" && detailEntry.summary) {
      parts.push(`Summary: ${detailEntry.summary}`);
      continue;
    }
    if (detailEntry.type === "reasoning.text" && detailEntry.text) {
      parts.push(detailEntry.text);
      continue;
    }
    if (detailEntry.type === "reasoning.encrypted") {
      parts.push("[Encrypted reasoning]");
      continue;
    }
    if (detailEntry.summary) {
      parts.push(`Summary: ${detailEntry.summary}`);
      continue;
    }
    if (detailEntry.text) {
      parts.push(detailEntry.text);
    }
  }
  if (parts.length === 0) {
    return null;
  }
  const combined = parts.join("\n\n");
  return combined.length > maxChars ? `${combined.slice(0, maxChars)}...` : combined;
};

const sanitizeMessage = (message: unknown): { role?: string; content?: string } | null => {
  if (!message || typeof message !== "object") return null;
  const entry = message as { role?: unknown; content?: unknown };
  const sanitized: { role?: string; content?: string } = {};
  if (typeof entry.role === "string") {
    sanitized.role = entry.role;
  }
  if (typeof entry.content === "string") {
    sanitized.content = entry.content;
  }
  return Object.keys(sanitized).length ? sanitized : null;
};

const resolveLogPath = () => {
  if (process.env.OPENROUTER_LOG_PATH) {
    return process.env.OPENROUTER_LOG_PATH;
  }
  const cwd = process.cwd();
  const isWebApp = path.basename(cwd) === "web" && path.basename(path.dirname(cwd)) === "apps";
  const root = isWebApp ? path.resolve(cwd, "..", "..") : cwd;
  return path.join(root, ".logs", "openrouter.jsonl");
};

const writeLogEntry = async (entry: Record<string, unknown>) => {
  const logPath = resolveLogPath();
  await mkdir(path.dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(entry)}\n`);
};

export const handleOpenRouterConfig = () => {
  return NextResponse.json({ configured: Boolean(process.env.OPENROUTER_API_KEY) });
};

export const handleOpenRouterPost = async (request: Request) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY is not configured." }, { status: 500 });
  }

  let payload: OpenRouterRequest;
  try {
    payload = (await request.json()) as OpenRouterRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!Array.isArray(payload?.messages) || !payload.messages.every(isMessage)) {
    return NextResponse.json({ error: "Request must include a messages array." }, { status: 400 });
  }

  const trace = payload.trace ?? null;
  const reasoning =
    payload.reasoning ??
    (payload.include_reasoning === undefined ? undefined : { exclude: !payload.include_reasoning });

  const startedAt = Date.now();
  const body = {
    model: payload.model,
    messages: payload.messages,
    temperature: payload.temperature,
    reasoning,
  };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": request.headers.get("origin") ?? "http://localhost",
      "X-Title": "TwentyNine",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  const durationMs = Date.now() - startedAt;
  const usage = data?.usage && typeof data.usage === "object" ? (data.usage as Record<string, unknown>) : null;
  const metrics = {
    durationMs,
    usage,
    costUsd: extractCostUsd(usage),
  };

  if (!response.ok) {
    const message = data?.error?.message || data?.error || "OpenRouter request failed.";
    const reasoningPreview = extractReasoningText(data?.choices?.[0]?.message, 2000);
    const logEntry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      ok: false,
      status: response.status,
      durationMs,
      model: data?.model ?? payload.model ?? null,
      requestId: data?.id ?? null,
      usage,
      costUsd: metrics.costUsd,
      error: message,
      reasoning: reasoningPreview,
      trace: trace ?? null,
    };
    try {
      await writeLogEntry(logEntry);
    } catch (error) {
      console.warn("Failed to write OpenRouter log entry.", error);
    }
    return NextResponse.json({ error: message, metrics }, { status: response.status });
  }

  const message = data?.choices?.[0]?.message ?? null;
  const reasoningPreview = extractReasoningText(message, 2000);
  const sanitizedMessage = sanitizeMessage(message);
  const logEntry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    ok: true,
    status: response.status,
    durationMs,
    model: data?.model ?? payload.model ?? null,
    requestId: data?.id ?? null,
    usage,
    costUsd: metrics.costUsd,
    reasoning: reasoningPreview,
    trace: trace ?? null,
  };
  try {
    await writeLogEntry(logEntry);
  } catch (error) {
    console.warn("Failed to write OpenRouter log entry.", error);
  }

  return NextResponse.json({
    id: data?.id ?? null,
    model: data?.model ?? payload.model ?? null,
    message: sanitizedMessage,
    usage: data?.usage ?? null,
    metrics,
  });
};

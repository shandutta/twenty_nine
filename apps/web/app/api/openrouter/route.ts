import { NextResponse } from "next/server";

type OpenRouterMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

type OpenRouterRequest = {
  messages: OpenRouterMessage[];
  model?: string;
  temperature?: number;
};

const isMessage = (value: unknown): value is OpenRouterMessage => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const message = value as OpenRouterMessage;
  return typeof message.role === "string" && typeof message.content === "string";
};

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.OPENROUTER_API_KEY),
  });
}

export async function POST(request: Request) {
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

  const body = {
    model: payload.model,
    messages: payload.messages,
    temperature: payload.temperature,
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

  if (!response.ok) {
    const message = data?.error?.message || data?.error || "OpenRouter request failed.";
    return NextResponse.json({ error: message }, { status: response.status });
  }

  const message = data?.choices?.[0]?.message ?? null;

  return NextResponse.json({
    id: data?.id ?? null,
    model: data?.model ?? payload.model ?? null,
    message,
    usage: data?.usage ?? null,
  });
}

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.OPENROUTER_API_KEY),
  });
}

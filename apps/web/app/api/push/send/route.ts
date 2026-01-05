import { NextResponse } from "next/server";
import { readPushTokens } from "@/lib/push-store";

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

export async function POST(request: Request) {
  const adminToken = process.env.PUSH_ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.json({ error: "PUSH_ADMIN_TOKEN is not configured." }, { status: 500 });
  }
  const provided = request.headers.get("x-admin-token");
  if (!provided || provided !== adminToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { title?: string; body?: string; data?: Record<string, unknown>; tokens?: string[] } | null = null;
  try {
    body = (await request.json()) as { title?: string; body?: string; data?: Record<string, unknown>; tokens?: string[] };
  } catch {
    body = null;
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const messageBody = typeof body?.body === "string" ? body.body.trim() : "";
  if (!title || !messageBody) {
    return NextResponse.json({ error: "title and body are required." }, { status: 400 });
  }

  const tokens = Array.isArray(body?.tokens) ? body?.tokens.filter(Boolean) : null;
  const targetTokens = tokens && tokens.length > 0 ? tokens : (await readPushTokens()).map((entry) => entry.token);
  if (targetTokens.length === 0) {
    return NextResponse.json({ error: "No push tokens registered." }, { status: 400 });
  }

  const messages: PushMessage[] = targetTokens.map((token) => ({
    to: token,
    title,
    body: messageBody,
    data: body?.data ?? undefined,
  }));

  const results: unknown[] = [];
  for (const batch of chunk(messages, 100)) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    const data = await response.json().catch(() => null);
    results.push({ ok: response.ok, response: data });
  }

  return NextResponse.json({ ok: true, batches: results.length, results });
}

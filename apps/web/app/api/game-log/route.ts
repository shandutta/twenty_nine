import { NextResponse } from "next/server";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type GameLogPayload = Record<string, unknown>;

const resolveLogPath = () => {
  if (process.env.GAME_LOG_PATH) {
    return process.env.GAME_LOG_PATH;
  }
  const cwd = process.cwd();
  const isWebApp = path.basename(cwd) === "web" && path.basename(path.dirname(cwd)) === "apps";
  const root = isWebApp ? path.resolve(cwd, "..", "..") : cwd;
  return path.join(root, ".logs", "game-events.jsonl");
};

const writeLogEntry = async (entry: GameLogPayload) => {
  const logPath = resolveLogPath();
  await mkdir(path.dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(entry)}\n`);
};

export async function GET() {
  return NextResponse.json({ configured: true });
}

export async function POST(request: Request) {
  let payload: GameLogPayload | null = null;
  try {
    payload = (await request.json()) as GameLogPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Payload must be an object." }, { status: 400 });
  }

  const entry = {
    ts: new Date().toISOString(),
    ...payload,
  };

  try {
    await writeLogEntry(entry);
  } catch (error) {
    console.warn("Failed to write game log entry.", error);
  }

  return NextResponse.json({ ok: true });
}

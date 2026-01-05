import { NextResponse } from "next/server";
import { issueTokens } from "@/lib/auth";

export async function POST(request: Request) {
  let body: { deviceId?: string } | null = null;
  try {
    body = (await request.json()) as { deviceId?: string };
  } catch {
    body = null;
  }

  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId is required." }, { status: 400 });
  }

  const tokens = issueTokens(deviceId);
  if (!tokens) {
    return NextResponse.json({ error: "AUTH_JWT_SECRET is not configured." }, { status: 500 });
  }

  return NextResponse.json(tokens);
}

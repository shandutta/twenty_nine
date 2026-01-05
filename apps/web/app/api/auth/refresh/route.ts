import { NextResponse } from "next/server";
import { issueTokens, verifyRefreshToken } from "@/lib/auth";

export async function POST(request: Request) {
  let body: { refreshToken?: string } | null = null;
  try {
    body = (await request.json()) as { refreshToken?: string };
  } catch {
    body = null;
  }

  const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken.trim() : "";
  if (!refreshToken) {
    return NextResponse.json({ error: "refreshToken is required." }, { status: 400 });
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    return NextResponse.json({ error: "Invalid refresh token." }, { status: 401 });
  }

  const tokens = issueTokens(payload.sub);
  if (!tokens) {
    return NextResponse.json({ error: "AUTH_JWT_SECRET is not configured." }, { status: 500 });
  }

  return NextResponse.json(tokens);
}

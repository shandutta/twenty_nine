import { NextResponse } from "next/server";
import { requireAccessToken } from "@/lib/auth";
import { upsertPushToken } from "@/lib/push-store";

export async function POST(request: Request) {
  const auth = requireAccessToken(request);
  if ("response" in auth) {
    return auth.response;
  }

  let body: { expoPushToken?: string; platform?: string; appVersion?: string } | null = null;
  try {
    body = (await request.json()) as { expoPushToken?: string; platform?: string; appVersion?: string };
  } catch {
    body = null;
  }

  const expoPushToken = typeof body?.expoPushToken === "string" ? body.expoPushToken.trim() : "";
  if (!expoPushToken) {
    return NextResponse.json({ error: "expoPushToken is required." }, { status: 400 });
  }

  await upsertPushToken({
    deviceId: auth.deviceId,
    token: expoPushToken,
    platform: typeof body?.platform === "string" ? body.platform : undefined,
    appVersion: typeof body?.appVersion === "string" ? body.appVersion : undefined,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import crypto from "node:crypto";

type TokenType = "access" | "refresh";

type JwtPayload = {
  sub: string;
  iat: number;
  exp: number;
  iss: string;
  typ: TokenType;
};

const ISSUER = process.env.AUTH_JWT_ISSUER ?? "twentynine";

const getSecret = (): string | null => {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 16) return null;
  return secret;
};

const base64Url = (input: string | Buffer): string => {
  return Buffer.from(input).toString("base64url");
};

const safeJsonParse = (value: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const signJwt = (payload: JwtPayload, secret: string): string => {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
};

const timingSafeEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
};

const verifyJwt = (token: string, secret: string, expectedType?: TokenType): JwtPayload | null => {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  if (!timingSafeEqual(signature, expectedSignature)) return null;
  const payloadJson = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const payload = safeJsonParse(payloadJson);
  if (!payload) return null;
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  const iss = typeof payload.iss === "string" ? payload.iss : null;
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  const typ = payload.typ === "access" || payload.typ === "refresh" ? payload.typ : null;
  const iat = typeof payload.iat === "number" ? payload.iat : now;
  const now = Math.floor(Date.now() / 1000);
  if (!exp || !iss || !sub || !typ) return null;
  if (iss !== ISSUER) return null;
  if (exp < now) return null;
  if (expectedType && typ !== expectedType) return null;
  return { exp, iss, sub, typ, iat };
};

export const issueTokens = (deviceId: string) => {
  const secret = getSecret();
  if (!secret) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  const accessExp = now + 15 * 60;
  const refreshExp = now + 30 * 24 * 60 * 60;
  const accessToken = signJwt({ sub: deviceId, iat: now, exp: accessExp, iss: ISSUER, typ: "access" }, secret);
  const refreshToken = signJwt({ sub: deviceId, iat: now, exp: refreshExp, iss: ISSUER, typ: "refresh" }, secret);
  return {
    accessToken,
    refreshToken,
    expiresIn: accessExp - now,
    refreshExpiresIn: refreshExp - now,
  };
};

export const verifyRefreshToken = (token: string): JwtPayload | null => {
  const secret = getSecret();
  if (!secret) return null;
  return verifyJwt(token, secret, "refresh");
};

export const verifyAccessToken = (token: string): JwtPayload | null => {
  const secret = getSecret();
  if (!secret) return null;
  return verifyJwt(token, secret, "access");
};

export const requireAccessToken = (
  request: Request
): { deviceId: string } | { response: NextResponse } => {
  const secret = getSecret();
  if (!secret) {
    return { response: NextResponse.json({ error: "AUTH_JWT_SECRET is not configured." }, { status: 500 }) };
  }
  const header = request.headers.get("authorization") ?? "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return { response: NextResponse.json({ error: "Missing auth token." }, { status: 401 }) };
  }
  const payload = verifyJwt(token, secret, "access");
  if (!payload) {
    return { response: NextResponse.json({ error: "Invalid auth token." }, { status: 401 }) };
  }
  return { deviceId: payload.sub };
};

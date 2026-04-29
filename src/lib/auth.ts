import { headers } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function getAuthTokenSigningKey() {
  const configured = process.env.AUTH_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (configured && configured.trim().length >= 32) {
    return configured;
  }
  console.error("[auth] AUTH_TOKEN_SECRET (or NEXTAUTH_SECRET) must be set and at least 32 chars");
  throw new Error("AUTH_CONFIG_MISSING");
}

function createAuthTokenSignature(payload: string) {
  return createHmac("sha256", getAuthTokenSigningKey()).update(payload).digest("hex");
}

export function createUserAuthToken(userId: number) {
  const expiresAt = Math.floor(Date.now() / 1000) + AUTH_TOKEN_TTL_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  const signature = createAuthTokenSignature(payload);
  return {
    token: `${payload}.${signature}`,
    expiresAt,
  };
}

function verifyUserAuthToken(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [rawUserId, rawExpiresAt, signature] = parts;
  if (!rawUserId || !rawExpiresAt || !signature) {
    return null;
  }

  const userId = Number(rawUserId);
  const expiresAt = Number(rawExpiresAt);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(expiresAt)) {
    return null;
  }
  if (expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }

  const payload = `${userId}.${expiresAt}`;
  const expectedSignature = createAuthTokenSignature(payload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  return userId;
}

// Auth skeleton: replace header-based identity with a real session provider.
export async function requireCurrentUserId(): Promise<number> {
  const requestHeaders = await headers();
  const authToken = requestHeaders.get("x-auth-token");
  if (!authToken) {
    console.warn("[auth] Missing x-auth-token header");
    throw new Error("UNAUTHORIZED");
  }

  const userIdFromToken = verifyUserAuthToken(authToken);
  if (!userIdFromToken) {
    console.warn("[auth] Invalid x-auth-token header");
    throw new Error("UNAUTHORIZED");
  }

  const userIdHeader = requestHeaders.get("x-user-id");
  if (!userIdHeader) {
    return userIdFromToken;
  }

  const userId = Number(userIdHeader);
  if (!Number.isInteger(userId) || userId <= 0) {
    console.warn("[auth] Invalid x-user-id header");
    throw new Error("UNAUTHORIZED");
  }
  if (userId !== userIdFromToken) {
    console.warn("[auth] x-user-id does not match x-auth-token");
    throw new Error("UNAUTHORIZED");
  }

  return userId;
}

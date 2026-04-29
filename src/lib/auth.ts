import { headers } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const KEY_LENGTH = 64;

export function createAuthSecret(): string {
  return randomBytes(24).toString("hex");
}

export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  const [salt, hexHash] = stored.split(":");
  if (!salt || !hexHash) {
    return false;
  }

  const currentHash = scryptSync(secret, salt, KEY_LENGTH);
  const storedHash = Buffer.from(hexHash, "hex");
  if (storedHash.length !== currentHash.length) {
    return false;
  }
  return timingSafeEqual(storedHash, currentHash);
}

// Auth skeleton: replace header-based identity with a real session provider.
export async function requireCurrentUserId(): Promise<number> {
  const requestHeaders = await headers();
  const userIdHeader = requestHeaders.get("x-user-id");
  const userSecretHeader = requestHeaders.get("x-user-secret");
  if (!userIdHeader || !userSecretHeader) {
    throw new Error("UNAUTHORIZED");
  }

  const userId = Number(userIdHeader);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { authSecretHash: true },
  });
  if (!user || !verifySecret(userSecretHeader, user.authSecretHash)) {
    throw new Error("UNAUTHORIZED");
  }

  return userId;
}

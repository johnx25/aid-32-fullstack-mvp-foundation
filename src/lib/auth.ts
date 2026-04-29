import { headers } from "next/headers";

// Auth skeleton: replace header-based identity with a real session provider.
export async function requireCurrentUserId(): Promise<number> {
  const requestHeaders = await headers();
  const userIdHeader = requestHeaders.get("x-user-id");

  if (!userIdHeader) {
    throw new Error("UNAUTHORIZED");
  }

  const userId = Number(userIdHeader);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("UNAUTHORIZED");
  }

  return userId;
}

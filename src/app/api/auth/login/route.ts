import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";
import { createUserAuthToken } from "@/lib/auth";
import { createHash } from "crypto";
import { normalizeEmail, isValidEmail } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export async function POST(request: Request) {
  let body: { email?: string; secret?: string };
  try {
    body = (await request.json()) as { email?: string; secret?: string };
  } catch {
    return fail(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const email = body.email ? normalizeEmail(body.email) : "";
  const secret = body.secret?.trim();
  if (!email || !secret || !isValidEmail(email) || secret.length < 8 || secret.length > 128) {
    return fail(400, "BAD_REQUEST", "email and secret are required");
  }

  const limit = checkRateLimit(`auth:login:${email}`, 5, 5 * 60 * 1000);
  if (!limit.allowed) {
    return fail(429, "BAD_REQUEST", "Too many login attempts. Please retry later.");
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
  if (!user || user.secretHash !== hashSecret(secret)) {
    log("warn", "auth.login.failed", { email });
    return fail(401, "UNAUTHORIZED", "Invalid credentials");
  }

  const auth = createUserAuthToken(user.id);

  return ok({
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    profile: user.profile,
    authToken: auth.token,
    authTokenExpiresAt: auth.expiresAt,
    tokenHint: "Use x-auth-token for authenticated MVP endpoints",
  });
}

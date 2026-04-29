import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";
import { AUTH_TOKEN_COOKIE_NAME, createUserAuthToken, getAuthCookieOptions } from "@/lib/auth";
import { normalizeEmail, isValidEmail } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { hashSecret, isLegacySecretHash, verifySecret } from "@/lib/secret-hash";

export async function POST(request: Request) {
  try {
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
      return fail(429, "TOO_MANY_REQUESTS", "Too many login attempts. Please retry later.");
    }

    const user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
    if (!user || !verifySecret(secret, user.secretHash)) {
      log("warn", "auth.login.failed", { email });
      return fail(401, "UNAUTHORIZED", "Invalid credentials");
    }
    if (isLegacySecretHash(user.secretHash)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { secretHash: hashSecret(secret) },
      });
    }

    const auth = createUserAuthToken(user.id);
    log("info", "auth.login.success", { userId: user.id, email: user.email });

    const response = ok({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      profile: user.profile,
      authTokenExpiresAt: new Date(auth.expiresAt * 1000).toISOString(),
    });
    response.cookies.set(AUTH_TOKEN_COOKIE_NAME, auth.token, getAuthCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_CONFIG_MISSING") {
      log("error", "auth.login.config_missing", {});
      return fail(500, "INTERNAL_ERROR", "Auth configuration is missing");
    }

    log("error", "auth.login.error", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

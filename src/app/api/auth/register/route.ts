import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { isValidEmail, normalizeEmail, sanitizeUserText } from "@/lib/validation";
import { hashSecret } from "@/lib/secret-hash";
import { assertAuthConfig, AUTH_TOKEN_COOKIE_NAME, createUserAuthToken, getAuthCookieOptions } from "@/lib/auth";

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function generateSecret() {
  return randomBytes(18).toString("base64url");
}

function isBetaInviteAccepted(inviteCode: string | undefined) {
  const betaMode = process.env.BETA_MODE === "true";
  if (!betaMode) return true;

  const allowList = (process.env.BETA_INVITE_CODES || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  if (allowList.length === 0) {
    return false;
  }

  return inviteCode ? allowList.includes(inviteCode.trim()) : false;
}

export async function POST(request: Request) {
  let body: {
    email?: unknown;
    displayName?: unknown;
    bio?: unknown;
    city?: unknown;
    interests?: unknown;
    inviteCode?: unknown;
    secret?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const rawEmail = asOptionalString(body.email);
  const rawDisplayName = asOptionalString(body.displayName);
  const rawBio = asOptionalString(body.bio);
  const rawCity = asOptionalString(body.city);
  const rawInterests = asOptionalString(body.interests);
  const rawInviteCode = asOptionalString(body.inviteCode);
  const rawSecret = asOptionalString(body.secret);
  const customSecret = rawSecret?.trim();

  const email = rawEmail ? normalizeEmail(rawEmail) : "";
  const displayName = rawDisplayName ? sanitizeUserText(rawDisplayName, 80) : "";
  const bio = rawBio ? sanitizeUserText(rawBio, 500) : "";
  const city = rawCity ? sanitizeUserText(rawCity, 120) : "";
  const interests = rawInterests ? sanitizeUserText(rawInterests, 500) : "";

  if (!isBetaInviteAccepted(rawInviteCode)) {
    return fail(403, "FORBIDDEN", "Beta mode is enabled. A valid invite code is required.");
  }

  if (!email || !displayName || !isValidEmail(email) || displayName.length < 2) {
    return fail(400, "BAD_REQUEST", "email and displayName are required");
  }
  if (customSecret && (customSecret.length < 8 || customSecret.length > 128)) {
    return fail(400, "BAD_REQUEST", "secret must be 8-128 characters");
  }
  const limit = checkRateLimit(`auth:register:${email}`, 3, 10 * 60 * 1000);
  if (!limit.allowed) {
    return fail(429, "TOO_MANY_REQUESTS", "Too many registration attempts. Please retry later.");
  }

  try {
    assertAuthConfig();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return fail(409, "CONFLICT", "A user with this email already exists");
    }

    const secret = customSecret || generateSecret();
    const shouldReturnGeneratedSecret = !customSecret;
    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        secretHash: hashSecret(secret),
        profile: {
          create: { bio, city, interests },
        },
      },
      include: { profile: true },
    });

    const auth = createUserAuthToken(user.id);
    log("info", "auth.register.success", { userId: user.id, email: user.email });

    const response = ok(
      {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        profile: user.profile,
        authTokenExpiresAt: new Date(auth.expiresAt * 1000).toISOString(),
        redirectTo: "/",
        ...(shouldReturnGeneratedSecret ? { secret } : {}),
      },
      201,
    );
    response.cookies.set(AUTH_TOKEN_COOKIE_NAME, auth.token, getAuthCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_CONFIG_MISSING") {
      log("error", "auth.register.config_missing", {});
      return fail(500, "INTERNAL_ERROR", "Auth configuration is missing");
    }

    log("error", "auth.register.error", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(409, "CONFLICT", "A user with this email already exists");
    }

    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

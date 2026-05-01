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

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
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
    birthDate?: unknown;
    gender?: unknown;
    community?: unknown;
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
  const rawBirthDate = asOptionalString(body.birthDate);
  const rawGender = asOptionalString(body.gender);
  const rawCommunity = asOptionalString(body.community);
  const customSecret = rawSecret?.trim();

  const email = rawEmail ? normalizeEmail(rawEmail) : "";
  const displayName = rawDisplayName ? sanitizeUserText(rawDisplayName, 80) : "";
  const bio = rawBio ? sanitizeUserText(rawBio, 500) : "";
  const city = rawCity ? sanitizeUserText(rawCity, 120) : "";
  const interests = rawInterests ? sanitizeUserText(rawInterests, 500) : "";
  const gender = rawGender ? sanitizeUserText(rawGender, 30) : undefined;
  const community = rawCommunity ? sanitizeUserText(rawCommunity, 50).toLowerCase() : "tamil";

  if (!isBetaInviteAccepted(rawInviteCode)) {
    return fail(403, "FORBIDDEN", "Beta mode is enabled. A valid invite code is required.");
  }

  if (!email || !displayName || !isValidEmail(email) || displayName.length < 2) {
    return fail(400, "BAD_REQUEST", "email and displayName are required");
  }

  // Tamil community check
  if (community !== "tamil") {
    return fail(403, "FORBIDDEN", "This platform is exclusively for the Tamil community.");
  }

  // Age verification: birthDate required, must be 18+
  if (!rawBirthDate) {
    return fail(400, "BAD_REQUEST", "birthDate is required");
  }
  const birthDateObj = new Date(rawBirthDate);
  if (isNaN(birthDateObj.getTime())) {
    return fail(400, "BAD_REQUEST", "birthDate must be a valid date (YYYY-MM-DD)");
  }
  if (calculateAge(birthDateObj) < 18) {
    return fail(403, "FORBIDDEN", "You must be at least 18 years old to register.");
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
    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        secretHash: hashSecret(secret),
        profile: {
          create: {
            bio,
            city,
            interests,
            birthDate: birthDateObj,
            gender,
            community,
          },
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
        secret,
        authTokenExpiresAt: new Date(auth.expiresAt * 1000).toISOString(),
        redirectTo: "/",
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

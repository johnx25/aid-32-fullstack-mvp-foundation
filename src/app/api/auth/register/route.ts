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

  if (allowList.length === 0) return false;
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

/** Derive a display name from an email address (part before @). */
function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._\-+]/g, " ").trim().slice(0, 80) || "User";
}

export async function POST(request: Request) {
  let body: {
    email?: unknown;
    password?: unknown;
    birthDate?: unknown;
    // kept for forward-compat but not required at registration anymore
    displayName?: unknown;
    inviteCode?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const rawEmail = asOptionalString(body.email);
  const rawPassword = asOptionalString(body.password);
  const rawBirthDate = asOptionalString(body.birthDate);
  const rawDisplayName = asOptionalString(body.displayName);
  const rawInviteCode = asOptionalString(body.inviteCode);

  const email = rawEmail ? normalizeEmail(rawEmail) : "";
  const password = rawPassword?.trim();

  // displayName: use provided value or derive from email
  const displayName = rawDisplayName
    ? sanitizeUserText(rawDisplayName, 80)
    : email
    ? displayNameFromEmail(email)
    : "";

  if (!isBetaInviteAccepted(rawInviteCode)) {
    return fail(403, "FORBIDDEN", "Beta mode is enabled. A valid invite code is required.");
  }

  if (!email || !isValidEmail(email)) {
    return fail(400, "BAD_REQUEST", "A valid email address is required.");
  }

  if (!password || password.length < 8 || password.length > 128) {
    return fail(400, "BAD_REQUEST", "Password must be between 8 and 128 characters.");
  }

  if (!rawBirthDate) {
    return fail(400, "BAD_REQUEST", "Date of birth is required.");
  }
  const birthDateObj = new Date(rawBirthDate);
  if (isNaN(birthDateObj.getTime())) {
    return fail(400, "BAD_REQUEST", "Date of birth must be a valid date (YYYY-MM-DD).");
  }
  if (calculateAge(birthDateObj) < 18) {
    return fail(403, "FORBIDDEN", "You must be at least 18 years old to register.");
  }

  const limit = checkRateLimit(`auth:register:${email}`, 3, 10 * 60 * 1000);
  if (!limit.allowed) {
    return fail(429, "TOO_MANY_REQUESTS", "Too many registration attempts. Please retry later.");
  }

  try {
    assertAuthConfig();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return fail(409, "CONFLICT", "An account with this email already exists.");
    }

    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        secretHash: hashSecret(password),
        profile: {
          create: {
            bio: "",
            city: "",
            interests: "",
            birthDate: birthDateObj,
            community: "tamil",
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
        authTokenExpiresAt: new Date(auth.expiresAt * 1000).toISOString(),
        redirectTo: "/profile/setup",
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
      return fail(409, "CONFLICT", "An account with this email already exists.");
    }
    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

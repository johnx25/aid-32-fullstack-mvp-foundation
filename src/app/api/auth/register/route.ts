import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { isValidEmail, normalizeEmail, sanitizeUserText } from "@/lib/validation";
import { hashSecret } from "@/lib/secret-hash";
import { registerUser } from "@/lib/register-user";
import { assertAuthConfig, AUTH_TOKEN_COOKIE_NAME, createUserAuthToken, getAuthCookieOptions } from "@/lib/auth";

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
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

  const displayName = rawDisplayName ? sanitizeUserText(rawDisplayName, 80) : undefined;

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

    const result = await registerUser(
      {
        findUserByEmail: (candidateEmail) => prisma.user.findUnique({ where: { email: candidateEmail } }),
        createUser: (data) =>
          prisma.user.create({
            data: {
              email: data.email,
              displayName: data.displayName,
              secretHash: data.secretHash,
              profile: {
                create: {
                  bio: "",
                  city: "",
                  interests: "",
                  birthDate: data.birthDate,
                  community: "tamil",
                },
              },
            },
          }),
        hashPassword: hashSecret,
      },
      {
        email,
        password,
        birthDate: birthDateObj,
        displayName,
      },
    );

    const auth = createUserAuthToken(result.userId);
    log("info", "auth.register.success", { userId: result.userId, email: result.email });

    const response = ok(
      {
        userId: result.userId,
        email: result.email,
        displayName: result.displayName,
        authTokenExpiresAt: new Date(auth.expiresAt * 1000).toISOString(),
        redirectTo: result.redirectTo,
      },
      201,
    );
    response.cookies.set(AUTH_TOKEN_COOKIE_NAME, auth.token, getAuthCookieOptions());
    return response;
  } catch (err: unknown) {
    const knownErr = err instanceof Error ? err : null;
    if (knownErr?.message === "AUTH_CONFIG_MISSING") {
      log("error", "auth.register.config_missing", {});
      return fail(500, "INTERNAL_ERROR", "Auth configuration is missing");
    }
    log("error", "auth.register.error", { reason: knownErr?.message ?? "unknown" });
    if (knownErr?.message === "EMAIL_ALREADY_EXISTS") {
      return fail(409, "CONFLICT", "An account with this email already exists.");
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err as Prisma.PrismaClientKnownRequestError).code === "P2002") {
      return fail(409, "CONFLICT", "An account with this email already exists.");
    }
    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

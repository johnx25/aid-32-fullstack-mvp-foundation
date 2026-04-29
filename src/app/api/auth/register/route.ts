import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { isValidEmail, normalizeEmail, sanitizeUserText } from "@/lib/validation";
import { hashSecret } from "@/lib/secret-hash";

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
  let body: { email?: string; displayName?: string; bio?: string; city?: string; interests?: string; inviteCode?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const email = body.email ? normalizeEmail(body.email) : "";
  const displayName = body.displayName ? sanitizeUserText(body.displayName, 80) : "";
  const bio = body.bio ? sanitizeUserText(body.bio, 500) : "";
  const city = body.city ? sanitizeUserText(body.city, 120) : "";
  const interests = body.interests ? sanitizeUserText(body.interests, 500) : "";

  if (!isBetaInviteAccepted(body.inviteCode)) {
    return fail(403, "FORBIDDEN", "Beta mode is enabled. A valid invite code is required.");
  }

  if (!email || !displayName || !isValidEmail(email) || displayName.length < 2) {
    return fail(400, "BAD_REQUEST", "email and displayName are required");
  }
  const limit = checkRateLimit(`auth:register:${email}`, 3, 10 * 60 * 1000);
  if (!limit.allowed) {
    return fail(429, "TOO_MANY_REQUESTS", "Too many registration attempts. Please retry later.");
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return fail(409, "CONFLICT", "A user with this email already exists");
    }

    const secret = generateSecret();
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

    log("info", "auth.register.success", { userId: user.id, email: user.email });

    return ok(
      {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        profile: user.profile,
        secret,
      },
      201,
    );
  } catch (error) {
    log("error", "auth.register.error", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(409, "CONFLICT", "A user with this email already exists");
    }

    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

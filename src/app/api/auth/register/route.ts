import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function generateSecret() {
  return randomBytes(18).toString("base64url");
}

export async function POST(request: Request) {
  let body: { email?: string; displayName?: string; bio?: string; city?: string; interests?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const email = body.email?.trim().toLowerCase();
  const displayName = body.displayName?.trim();
  const bio = body.bio?.trim() || "";
  const city = body.city?.trim() || "";
  const interests = body.interests?.trim() || "";

  if (!email || !displayName) {
    return fail(400, "BAD_REQUEST", "email and displayName are required");
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(409, "CONFLICT", "A user with this email already exists");
    }

    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

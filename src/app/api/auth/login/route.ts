import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";
import { createHash } from "crypto";

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

  const email = body.email?.trim().toLowerCase();
  const secret = body.secret?.trim();
  if (!email || !secret) {
    return fail(400, "BAD_REQUEST", "email and secret are required");
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
  if (!user || user.secretHash !== hashSecret(secret)) {
    console.warn(`[auth] Failed login attempt for ${email}`);
    return fail(401, "UNAUTHORIZED", "Invalid credentials");
  }

  return ok({
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    profile: user.profile,
    tokenHint: "Use x-user-id header with this userId for authenticated MVP endpoints",
  });
}

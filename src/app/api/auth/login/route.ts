import { prisma } from "@/lib/prisma";
import { verifySecret } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: { email?: string; secret?: string };
  try {
    body = (await request.json()) as { email?: string; secret?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const secret = body.secret?.trim();
  if (!email || !secret) {
    return NextResponse.json({ error: "email and secret are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  if (!verifySecret(secret, user.authSecretHash)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  return NextResponse.json({
    data: {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      profile: user.profile,
      tokenHint: "Use x-user-id and x-user-secret headers for authenticated MVP endpoints",
      session: {
        userId: user.id,
        secret,
      },
    },
  });
}

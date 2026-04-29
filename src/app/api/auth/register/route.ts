import { prisma } from "@/lib/prisma";
import { createAuthSecret, hashSecret } from "@/lib/auth";
import { NextResponse } from "next/server";

const MIN_SECRET_LENGTH = 12;

export async function POST(request: Request) {
  let body: { email?: string; displayName?: string; secret?: string; bio?: string; city?: string; interests?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const displayName = body.displayName?.trim();
  const secretInput = body.secret?.trim();
  const bio = body.bio?.trim() || "";
  const city = body.city?.trim() || "";
  const interests = body.interests?.trim() || "";

  if (!email || !displayName) {
    return NextResponse.json({ error: "email and displayName are required" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }

  const generatedSecret = secretInput || createAuthSecret();
  if (generatedSecret.length < MIN_SECRET_LENGTH) {
    return NextResponse.json(
      { error: `secret must be at least ${MIN_SECRET_LENGTH} characters` },
      { status: 400 },
    );
  }

  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      authSecretHash: hashSecret(generatedSecret),
      profile: {
        create: { bio, city, interests },
      },
    },
    include: { profile: true },
  });

  if (!user.profile) {
    const profile = await prisma.profile.create({
      data: { userId: user.id, bio, city, interests },
    });

    return NextResponse.json(
      {
        data: {
          userId: user.id,
          email: user.email,
          displayName: user.displayName,
          profile,
          secret: generatedSecret,
        },
      },
      { status: 201 },
    );
  }

  return NextResponse.json(
    {
      data: {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        profile: user.profile,
        secret: generatedSecret,
      },
    },
    { status: 201 },
  );
}

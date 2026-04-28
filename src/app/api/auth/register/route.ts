import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: { email?: string; displayName?: string; bio?: string; city?: string; interests?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const displayName = body.displayName?.trim();
  const bio = body.bio?.trim() || "";
  const city = body.city?.trim() || "";
  const interests = body.interests?.trim() || "";

  if (!email || !displayName) {
    return NextResponse.json({ error: "email and displayName are required" }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { displayName },
    create: {
      email,
      displayName,
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

    return NextResponse.json({ data: { userId: user.id, email: user.email, displayName: user.displayName, profile } }, { status: 201 });
  }

  return NextResponse.json(
    { data: { userId: user.id, email: user.email, displayName: user.displayName, profile: user.profile } },
    { status: 201 },
  );
}

import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const currentUserId = await requireCurrentUserId();
    const profile = await prisma.profile.findUnique({
      where: { userId: currentUserId },
      include: { user: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        profileId: profile.id,
        userId: profile.userId,
        email: profile.user.email,
        displayName: profile.user.displayName,
        bio: profile.bio,
        city: profile.city,
        interests: profile.interests,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUserId = await requireCurrentUserId();
    let body: { displayName?: string; bio?: string; city?: string; interests?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const existing = await prisma.profile.findUnique({ where: { userId: currentUserId }, include: { user: true } });
    if (!existing) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const displayName = body.displayName?.trim();
    const bio = body.bio?.trim();
    const city = body.city?.trim();
    const interests = body.interests?.trim();

    if (displayName) {
      await prisma.user.update({ where: { id: currentUserId }, data: { displayName } });
    }

    const updated = await prisma.profile.update({
      where: { userId: currentUserId },
      data: {
        bio: bio ?? undefined,
        city: city ?? undefined,
        interests: interests ?? undefined,
      },
      include: { user: true },
    });

    return NextResponse.json({
      data: {
        profileId: updated.id,
        userId: updated.userId,
        email: updated.user.email,
        displayName: updated.user.displayName,
        bio: updated.bio,
        city: updated.city,
        interests: updated.interests,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

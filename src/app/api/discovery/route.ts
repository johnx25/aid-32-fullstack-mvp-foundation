import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const currentUserId = await requireCurrentUserId();

    const profiles = await prisma.profile.findMany({
      where: { userId: { not: currentUserId } },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const sentLikes = await prisma.like.findMany({
      where: { fromUserId: currentUserId },
      select: { toUserId: true },
    });
    const likedUserIds = new Set(sentLikes.map((l) => l.toUserId));

    return NextResponse.json({
      data: profiles.map((p) => ({
        profileId: p.id,
        userId: p.userId,
        displayName: p.user.displayName,
        bio: p.bio,
        city: p.city,
        interests: p.interests,
        likedByCurrentUser: likedUserIds.has(p.userId),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

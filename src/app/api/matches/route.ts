import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const currentUserId = await requireCurrentUserId();

    const matches = await prisma.match.findMany({
      where: {
        OR: [{ userAId: currentUserId }, { userBId: currentUserId }],
      },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: matches.map((m) => {
        const other = m.userAId === currentUserId ? m.userB : m.userA;
        return {
          matchId: m.id,
          createdAt: m.createdAt,
          userId: other.id,
          displayName: other.displayName,
          profile: other.profile
            ? {
                profileId: other.profile.id,
                bio: other.profile.bio,
                city: other.profile.city,
                interests: other.profile.interests,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

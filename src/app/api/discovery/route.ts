import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { log } from "@/lib/logger";
import { DEFAULT_AVATAR_URL } from "@/lib/validation";

export async function GET() {
  try {
    const currentUserId = await requireCurrentUserId();

    const profiles = await prisma.profile.findMany({
      where: { userId: { not: currentUserId } },
      include: { user: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const sentLikes = await prisma.like.findMany({
      where: { fromUserId: currentUserId },
      select: { toUserId: true },
    });
    const likedUserIds = new Set(sentLikes.map((l: { toUserId: number }) => l.toUserId));
    log("info", "discovery.viewed", { currentUserId, resultCount: profiles.length });

    type ProfileWithUser = (typeof profiles)[number];
    return ok(
      profiles.map((p: ProfileWithUser) => ({
        profileId: p.id,
        userId: p.userId,
        displayName: p.user.displayName,
        avatarUrl: p.avatarUrl || DEFAULT_AVATAR_URL,
        bio: p.bio,
        city: p.city,
        interests: p.interests,
        likedByCurrentUser: likedUserIds.has(p.userId),
      })),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "UNAUTHORIZED", "Unauthorized");
    }

    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

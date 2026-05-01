import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { DEFAULT_AVATAR_URL } from "@/lib/validation";

export async function GET() {
  try {
    const currentUserId = await requireCurrentUserId();

    const matches = await prisma.match.findMany({
      where: {
        OR: [{ userAId: currentUserId }, { userBId: currentUserId }],
      },
      include: {
        userA: { select: { id: true, displayName: true, profile: true } },
        userB: { select: { id: true, displayName: true, profile: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    type MatchWithUsers = (typeof matches)[number];
    return ok(
      matches.map((m: MatchWithUsers) => {
        const other = m.userAId === currentUserId ? m.userB : m.userA;
        return {
          matchId: m.id,
          createdAt: m.createdAt,
          userId: other.id,
          displayName: other.displayName,
          profile: other.profile
            ? {
                profileId: other.profile.id,
                avatarUrl: other.profile.avatarUrl || DEFAULT_AVATAR_URL,
                bio: other.profile.bio,
                city: other.profile.city,
                interests: other.profile.interests,
              }
            : null,
        };
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "UNAUTHORIZED", "Unauthorized");
    }

    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

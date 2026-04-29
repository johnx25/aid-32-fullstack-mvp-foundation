import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { hasMinimumProfileQuality, validatePositiveInt } from "@/lib/validation";
import { log } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const currentUserId = await requireCurrentUserId();
    let body: { targetProfileId?: number };
    try {
      body = (await request.json()) as { targetProfileId?: number };
    } catch {
      return fail(400, "BAD_REQUEST", "Invalid JSON body");
    }

    if (!validatePositiveInt(body.targetProfileId)) {
      return fail(400, "BAD_REQUEST", "targetProfileId is required");
    }

    const targetProfile = await prisma.profile.findUnique({
      where: { id: body.targetProfileId },
      include: { user: true },
    });

    if (!targetProfile) {
      return fail(404, "NOT_FOUND", "Target profile not found");
    }

    if (targetProfile.userId === currentUserId) {
      return fail(400, "BAD_REQUEST", "You cannot like yourself");
    }

    const ownProfile = await prisma.profile.findUnique({ where: { userId: currentUserId } });
    if (!ownProfile) {
      return fail(404, "NOT_FOUND", "Current user profile not found");
    }

    if (!hasMinimumProfileQuality(ownProfile)) {
      return fail(403, "PROFILE_INCOMPLETE", "Complete your profile first (avatar + bio) before liking others.");
    }

    await prisma.like.upsert({
      where: { fromUserId_toUserId: { fromUserId: currentUserId, toUserId: targetProfile.userId } },
      update: {},
      create: {
        fromUserId: currentUserId,
        toUserId: targetProfile.userId,
        fromProfileId: ownProfile.id,
        toProfileId: targetProfile.id,
      },
    });

    const reciprocalLike = await prisma.like.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId: targetProfile.userId,
          toUserId: currentUserId,
        },
      },
    });

    let isMatch = false;
    let matchId: number | null = null;
    if (reciprocalLike) {
      const [userAId, userBId] = [currentUserId, targetProfile.userId].sort((a, b) => a - b);
      const match = await prisma.match.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: {},
        create: { userAId, userBId },
      });
      isMatch = true;
      matchId = match.id;
      log("info", "match.created_or_found", { userAId, userBId, matchId: match.id });
    }

    return ok({ likedUserId: targetProfile.userId, isMatch, matchId }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "UNAUTHORIZED", "Unauthorized");
    }

    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

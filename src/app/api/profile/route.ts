import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { DEFAULT_AVATAR_URL, sanitizeUserText } from "@/lib/validation";

export async function GET() {
  try {
    const currentUserId = await requireCurrentUserId();
    const profile = await prisma.profile.findUnique({
      where: { userId: currentUserId },
      include: { user: true },
    });

    if (!profile) {
      return fail(404, "NOT_FOUND", "Profile not found");
    }

    return ok({
      profileId: profile.id,
      userId: profile.userId,
      email: profile.user.email,
      displayName: profile.user.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      city: profile.city,
      interests: profile.interests,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "UNAUTHORIZED", "Unauthorized");
    }

    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUserId = await requireCurrentUserId();
    let body: { displayName?: string; bio?: string; city?: string; interests?: string; avatarUrl?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return fail(400, "BAD_REQUEST", "Invalid JSON body");
    }

    const existing = await prisma.profile.findUnique({ where: { userId: currentUserId }, include: { user: true } });
    if (!existing) {
      return fail(404, "NOT_FOUND", "Profile not found");
    }

    const hasDisplayName = "displayName" in body;
    const hasBio = "bio" in body;
    const hasCity = "city" in body;
    const hasInterests = "interests" in body;
    const hasAvatarUrl = "avatarUrl" in body;

    const displayName = hasDisplayName ? sanitizeUserText(body.displayName ?? "", 80) : undefined;
    const bio = hasBio ? sanitizeUserText(body.bio ?? "", 500) : undefined;
    const city = hasCity ? sanitizeUserText(body.city ?? "", 120) : undefined;
    const interests = hasInterests ? sanitizeUserText(body.interests ?? "", 500) : undefined;
    const avatarUrl = hasAvatarUrl ? sanitizeUserText(body.avatarUrl ?? "", 300) : undefined;

    if (hasDisplayName) {
      if (!displayName || displayName.length < 2) {
        return fail(400, "BAD_REQUEST", "displayName must be at least 2 characters");
      }
      await prisma.user.update({ where: { id: currentUserId }, data: { displayName } });
    }

    const updated = await prisma.profile.update({
      where: { userId: currentUserId },
      data: {
        avatarUrl,
        bio,
        city,
        interests,
      },
      include: { user: true },
    });

    return ok({
      profileId: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      displayName: updated.user.displayName,
      avatarUrl: updated.avatarUrl || DEFAULT_AVATAR_URL,
      bio: updated.bio,
      city: updated.city,
      interests: updated.interests,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "UNAUTHORIZED", "Unauthorized");
    }

    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

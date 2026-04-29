import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";

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
    let body: { displayName?: string; bio?: string; city?: string; interests?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return fail(400, "BAD_REQUEST", "Invalid JSON body");
    }

    const existing = await prisma.profile.findUnique({ where: { userId: currentUserId }, include: { user: true } });
    if (!existing) {
      return fail(404, "NOT_FOUND", "Profile not found");
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

    return ok({
      profileId: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      displayName: updated.user.displayName,
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

import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { DEFAULT_AVATAR_URL, sanitizeUserText } from "@/lib/validation";

export async function GET() {
  try {
    const currentUserId = await requireCurrentUserId();
    const profile = await prisma.profile.findUnique({
      where: { userId: currentUserId },
      include: { user: { select: { email: true, displayName: true } } },
    });

    if (!profile) {
      return fail(404, "NOT_FOUND", "Profile not found");
    }

    return ok({
      profileId: profile.id,
      userId: profile.userId,
      email: profile.user.email,
      displayName: profile.user.displayName,
      avatarUrl: profile.avatarUrl || DEFAULT_AVATAR_URL,
      bio: profile.bio,
      city: profile.city,
      interests: profile.interests,
      gender: profile.gender,
      interestedIn: profile.interestedIn,
      height: profile.height,
      education: profile.education,
      job: profile.job,
      religion: profile.religion,
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
    let body: { displayName?: string; bio?: string; city?: string; interests?: string; avatarUrl?: string; gender?: string; interestedIn?: string; height?: number; education?: string; job?: string; religion?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return fail(400, "BAD_REQUEST", "Invalid JSON body");
    }

    const existing = await prisma.profile.findUnique({
      where: { userId: currentUserId },
      include: { user: { select: { id: true } } },
    });
    if (!existing) {
      return fail(404, "NOT_FOUND", "Profile not found");
    }

    const VALID_GENDER = ["mann", "frau", "divers", "keine_angabe"];
    const VALID_EDUCATION = ["abitur", "bachelor", "master", "promotion", "ausbildung", "sonstiges"];
    const VALID_RELIGION = ["hinduismus", "islam", "christentum", "sikhismus", "kein", "sonstiges"];

    const hasDisplayName = "displayName" in body;
    const hasBio = "bio" in body;
    const hasCity = "city" in body;
    const hasInterests = "interests" in body;
    const hasAvatarUrl = "avatarUrl" in body;
    const hasGender = "gender" in body;
    const hasInterestedIn = "interestedIn" in body;
    const hasHeight = "height" in body;
    const hasEducation = "education" in body;
    const hasJob = "job" in body;
    const hasReligion = "religion" in body;

    const displayName = hasDisplayName ? sanitizeUserText(body.displayName ?? "", 80) : undefined;
    const bio = hasBio ? sanitizeUserText(body.bio ?? "", 500) : undefined;
    const city = hasCity ? sanitizeUserText(body.city ?? "", 120) : undefined;
    const interests = hasInterests ? sanitizeUserText(body.interests ?? "", 500) : undefined;
    const avatarUrl = hasAvatarUrl ? sanitizeUserText(body.avatarUrl ?? "", 300) : undefined;
    const gender = hasGender ? (VALID_GENDER.includes(body.gender ?? "") ? body.gender : null) : undefined;
    const interestedIn = hasInterestedIn ? (VALID_GENDER.includes(body.interestedIn ?? "") ? body.interestedIn : null) : undefined;
    const height = hasHeight ? (typeof body.height === "number" && body.height >= 100 && body.height <= 250 ? body.height : null) : undefined;
    const education = hasEducation ? (VALID_EDUCATION.includes(body.education ?? "") ? body.education : null) : undefined;
    const job = hasJob ? sanitizeUserText(body.job ?? "", 120) : undefined;
    const religion = hasReligion ? (VALID_RELIGION.includes(body.religion ?? "") ? body.religion : null) : undefined;

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
        gender,
        interestedIn,
        height,
        education,
        job,
        religion,
      },
      include: { user: { select: { email: true, displayName: true } } },
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
      gender: updated.gender,
      interestedIn: updated.interestedIn,
      height: updated.height,
      education: updated.education,
      job: updated.job,
      religion: updated.religion,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "UNAUTHORIZED", "Unauthorized");
    }

    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

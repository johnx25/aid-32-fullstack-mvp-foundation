import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { log } from "@/lib/logger";
import { DEFAULT_AVATAR_URL } from "@/lib/validation";
import { Prisma } from "@prisma/client";

// ─── 20 Filter options ───────────────────────────────────────────────────────
//  1. gender          – Geschlecht des gesuchten Profils
//  2. interestedIn    – Wen sucht der gesuchte Nutzer
//  3. minAge          – Mindestalter
//  4. maxAge          – Maximalalter
//  5. minHeight       – Mindestgröße (cm)
//  6. maxHeight       – Maximalgröße (cm)
//  7. city            – Stadt (enthält-Suche)
//  8. education       – Ausbildungsgrad
//  9. religion        – Religion
// 10. hasPhoto        – Nur Profile mit Avatar
// 11. hasBio          – Nur Profile mit Bio
// 12. hasJob          – Nur Profile mit Job-Angabe
// 13. interests       – Interessen-Keyword (enthält-Suche)
// 14. job             – Job-Keyword (enthält-Suche)
// 15. community       – Community (Standard: tamil)
// 16. minHeightStrict – Größe exakt oder größer (alias für minHeight, separates Flag)
// 17. sortBy          – Sortierung: newest | oldest | city
// 18. excludeLiked    – Bereits gelikte Profile ausblenden
// 19. limit           – Anzahl Ergebnisse (max 100)
// 20. page            – Seite (Pagination)

function parseIntParam(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function ageToDate(age: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d;
}

export async function GET(request: Request) {
  try {
    const currentUserId = await requireCurrentUserId();
    const { searchParams } = new URL(request.url);

    // ── Parse all 20 filter params ──────────────────────────────────────────
    const filterGender     = searchParams.get("gender");          // 1
    const filterIntIn      = searchParams.get("interestedIn");    // 2
    const minAge           = parseIntParam(searchParams.get("minAge"), 0);        // 3
    const maxAge           = parseIntParam(searchParams.get("maxAge"), 120);      // 4
    const minHeight        = parseIntParam(searchParams.get("minHeight"), 0);     // 5
    const maxHeight        = parseIntParam(searchParams.get("maxHeight"), 999);   // 6
    const filterCity       = searchParams.get("city");            // 7
    const filterEducation  = searchParams.get("education");       // 8
    const filterReligion   = searchParams.get("religion");        // 9
    const hasPhoto         = searchParams.get("hasPhoto") === "true";    // 10
    const hasBio           = searchParams.get("hasBio") === "true";      // 11
    const hasJob           = searchParams.get("hasJob") === "true";      // 12
    const filterInterests  = searchParams.get("interests");       // 13
    const filterJob        = searchParams.get("job");             // 14
    const filterCommunity  = searchParams.get("community") ?? "tamil";   // 15
    const strictHeight     = searchParams.get("strictHeight") === "true"; // 16
    const sortBy           = searchParams.get("sortBy") ?? "newest";      // 17
    const excludeLiked     = searchParams.get("excludeLiked") !== "false"; // 18 (default true)
    const limit            = Math.min(parseIntParam(searchParams.get("limit"), 50), 100); // 19
    const page             = Math.max(parseIntParam(searchParams.get("page"), 1), 1);     // 20

    // ── Build WHERE clause ──────────────────────────────────────────────────
    const where: Prisma.ProfileWhereInput = {
      userId: { not: currentUserId },
      community: filterCommunity,
    };

    if (filterGender) where.gender = filterGender;
    if (filterIntIn)  where.interestedIn = filterIntIn;
    if (filterEducation) where.education = filterEducation;
    if (filterReligion)  where.religion = filterReligion;

    if (filterCity) {
      where.city = { contains: filterCity, mode: "insensitive" };
    }
    if (filterInterests) {
      where.interests = { contains: filterInterests, mode: "insensitive" };
    }
    // hasJob and filterJob: merge into a single AND condition to avoid overwrite
    if (hasJob && filterJob) {
      where.AND = [
        { job: { not: null } },
        { job: { contains: filterJob, mode: "insensitive" } },
      ];
    } else if (filterJob) {
      where.job = { contains: filterJob, mode: "insensitive" };
    } else if (hasJob) {
      where.job = { not: null };
    }

    if (hasPhoto) {
      where.avatarUrl = { not: { equals: DEFAULT_AVATAR_URL } };
    }
    if (hasBio) {
      where.bio = { not: "" };
    }

    if (minAge > 0 || maxAge < 120) {
      where.birthDate = {
        gte: maxAge < 120 ? ageToDate(maxAge) : undefined,
        lte: minAge > 0 ? ageToDate(minAge) : undefined,
      };
    }

    if (minHeight > 0 || maxHeight < 999 || strictHeight) {
      where.height = {
        gte: minHeight > 0 ? minHeight : undefined,
        lte: maxHeight < 999 ? maxHeight : undefined,
      };
    }

    // ── Fetch liked user IDs once (used for exclude filter + flag) ──────────
    const sentLikesAll = await prisma.like.findMany({
      where: { fromUserId: currentUserId },
      select: { toUserId: true },
    });
    const likedUserIds = sentLikesAll.map((l) => l.toUserId);
    const likedSet = new Set(likedUserIds);

    // ── Exclude already-liked profiles ──────────────────────────────────────
    if (excludeLiked && likedUserIds.length > 0) {
      where.userId = { notIn: likedUserIds, not: currentUserId };
    }

    // ── Sorting ─────────────────────────────────────────────────────────────
    const orderBy: Prisma.ProfileOrderByWithRelationInput =
      sortBy === "oldest" ? { createdAt: "asc" }
      : sortBy === "city"   ? { city: "asc" }
      : { createdAt: "desc" };

    // ── Query ────────────────────────────────────────────────────────────────
    const [profiles, total] = await prisma.$transaction([
      prisma.profile.findMany({
        where,
        include: { user: { select: { displayName: true } } },
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.profile.count({ where }),
    ]);

    log("info", "discovery.viewed", { currentUserId, resultCount: profiles.length, total });

    type ProfileRow = (typeof profiles)[number];
    const profileList = profiles.map((p: ProfileRow) => ({
        profileId: p.id,
        userId: p.userId,
        displayName: p.user.displayName,
        avatarUrl: p.avatarUrl || DEFAULT_AVATAR_URL,
        bio: p.bio,
        city: p.city,
        interests: p.interests,
        gender: p.gender,
        interestedIn: p.interestedIn,
        height: p.height,
        education: p.education,
        job: p.job,
        religion: p.religion,
        likedByCurrentUser: likedSet.has(p.userId),
      }));

    // Return array directly for backward compatibility + pagination meta in header
    // New consumers can read X-Total-Count and X-Total-Pages headers
    const response = ok(profileList);
    response.headers.set("X-Total-Count", String(total));
    response.headers.set("X-Total-Pages", String(Math.ceil(total / limit)));
    response.headers.set("X-Page", String(page));
    response.headers.set("X-Limit", String(limit));
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "UNAUTHORIZED", "Unauthorized");
    }
    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const currentUserId = await requireCurrentUserId();
    const body = (await request.json()) as { targetProfileId?: number };

    if (!body.targetProfileId || !Number.isInteger(body.targetProfileId)) {
      return NextResponse.json({ error: "targetProfileId is required" }, { status: 400 });
    }

    const targetProfile = await prisma.profile.findUnique({
      where: { id: body.targetProfileId },
      include: { user: true },
    });

    if (!targetProfile) {
      return NextResponse.json({ error: "Target profile not found" }, { status: 404 });
    }

    if (targetProfile.userId === currentUserId) {
      return NextResponse.json({ error: "You cannot like yourself" }, { status: 400 });
    }

    const ownProfile = await prisma.profile.findUnique({ where: { userId: currentUserId } });
    if (!ownProfile) {
      return NextResponse.json({ error: "Current user profile not found" }, { status: 404 });
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
    if (reciprocalLike) {
      const [userAId, userBId] = [currentUserId, targetProfile.userId].sort((a, b) => a - b);
      await prisma.match.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: {},
        create: { userAId, userBId },
      });
      isMatch = true;
    }

    return NextResponse.json({ data: { likedUserId: targetProfile.userId, isMatch } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

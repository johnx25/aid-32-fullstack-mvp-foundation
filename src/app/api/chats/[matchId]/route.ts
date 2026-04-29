import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { NextResponse } from "next/server";

function parseMatchId(value: string): number | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

async function verifyMembership(matchId: number, userId: number) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    return { ok: false as const, status: 404, error: "Match not found" };
  }
  if (match.userAId !== userId && match.userBId !== userId) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const };
}

export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const currentUserId = await requireCurrentUserId();
    const { matchId: rawMatchId } = await params;
    const matchId = parseMatchId(rawMatchId);
    if (!matchId) {
      return NextResponse.json({ error: "Invalid matchId" }, { status: 400 });
    }

    const membership = await verifyMembership(matchId, currentUserId);
    if (!membership.ok) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }

    const messages = await prisma.message.findMany({
      where: { matchId },
      include: { sender: true },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return NextResponse.json({
      data: messages.map((m) => ({
        messageId: m.id,
        matchId: m.matchId,
        senderId: m.senderId,
        senderDisplayName: m.sender.displayName,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const currentUserId = await requireCurrentUserId();
    const { matchId: rawMatchId } = await params;
    const matchId = parseMatchId(rawMatchId);
    if (!matchId) {
      return NextResponse.json({ error: "Invalid matchId" }, { status: 400 });
    }

    const membership = await verifyMembership(matchId, currentUserId);
    if (!membership.ok) {
      return NextResponse.json({ error: membership.error }, { status: membership.status });
    }

    let body: { content?: string };
    try {
      body = (await request.json()) as { content?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const content = body.content?.trim();
    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const message = await prisma.message.create({
      data: {
        matchId,
        senderId: currentUserId,
        content,
      },
      include: { sender: true },
    });

    return NextResponse.json(
      {
        data: {
          messageId: message.id,
          matchId: message.matchId,
          senderId: message.senderId,
          senderDisplayName: message.sender.displayName,
          content: message.content,
          createdAt: message.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

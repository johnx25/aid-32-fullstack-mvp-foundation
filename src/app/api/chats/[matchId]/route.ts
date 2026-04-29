import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import { sanitizeUserText } from "@/lib/validation";
import { log } from "@/lib/logger";

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
    return { ok: false as const, status: 404, code: "NOT_FOUND" as const, message: "Match not found" };
  }
  if (match.userAId !== userId && match.userBId !== userId) {
    return { ok: false as const, status: 403, code: "FORBIDDEN" as const, message: "Forbidden" };
  }
  return { ok: true as const };
}

export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const currentUserId = await requireCurrentUserId();
    const { matchId: rawMatchId } = await params;
    const matchId = parseMatchId(rawMatchId);
    if (!matchId) {
      return fail(400, "BAD_REQUEST", "Invalid matchId");
    }

    const membership = await verifyMembership(matchId, currentUserId);
    if (!membership.ok) {
      return fail(membership.status, membership.code, membership.message);
    }

    const messages = await prisma.message.findMany({
      where: { matchId },
      include: { sender: true },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return ok(
      messages.map((m) => ({
        messageId: m.id,
        matchId: m.matchId,
        senderId: m.senderId,
        senderDisplayName: m.sender.displayName,
        content: m.content,
        createdAt: m.createdAt,
      })),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "UNAUTHORIZED", "Unauthorized");
    }

    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const currentUserId = await requireCurrentUserId();
    const { matchId: rawMatchId } = await params;
    const matchId = parseMatchId(rawMatchId);
    if (!matchId) {
      return fail(400, "BAD_REQUEST", "Invalid matchId");
    }

    let body: { content?: string };
    try {
      body = (await request.json()) as { content?: string };
    } catch {
      return fail(400, "BAD_REQUEST", "Invalid JSON body");
    }

    const content = body.content ? sanitizeUserText(body.content, 1000) : "";
    if (!content) {
      return fail(400, "BAD_REQUEST", "content is required");
    }

    const message = await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id: matchId } });
      if (!match) {
        throw new Error("MATCH_NOT_FOUND");
      }
      if (match.userAId !== currentUserId && match.userBId !== currentUserId) {
        throw new Error("FORBIDDEN_MATCH");
      }

      return tx.message.create({
        data: {
          matchId,
          senderId: currentUserId,
          content,
        },
        include: { sender: true },
      });
    });

    log("info", "chat.message.created", { matchId, currentUserId, messageId: message.id });

    return ok(
      {
        messageId: message.id,
        matchId: message.matchId,
        senderId: message.senderId,
        senderDisplayName: message.sender.displayName,
        content: message.content,
        createdAt: message.createdAt,
      },
      201,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "MATCH_NOT_FOUND") {
      return fail(404, "NOT_FOUND", "Match not found");
    }
    if (error instanceof Error && error.message === "FORBIDDEN_MATCH") {
      return fail(403, "FORBIDDEN", "Forbidden");
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "UNAUTHORIZED", "Unauthorized");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return fail(404, "NOT_FOUND", "Match not found");
    }

    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";
import { sanitizeUserText } from "@/lib/validation";
import { log } from "@/lib/logger";
import { requireCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const currentUserId = await requireCurrentUserId();
    const tasks = await prisma.task.findMany({
      where: { userId: currentUserId },
      orderBy: { createdAt: "desc" },
    });

    return ok(tasks);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "UNAUTHORIZED", "Unauthorized");
    }
    log("error", "tasks.list.error", { reason: error instanceof Error ? error.message : "unknown" });
    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function POST(request: Request) {
  let body: {
    title?: string;
    description?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const title = body.title ? sanitizeUserText(body.title, 160) : "";
  if (!title) {
    return fail(400, "BAD_REQUEST", "Title is required");
  }

  try {
    const currentUserId = await requireCurrentUserId();
    const task = await prisma.task.create({
      data: {
        userId: currentUserId,
        title,
        description: body.description ? sanitizeUserText(body.description, 2000) : null,
      },
    });

    return ok(task, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return fail(401, "UNAUTHORIZED", "Unauthorized");
    }
    log("error", "tasks.create.error", { reason: error instanceof Error ? error.message : "unknown" });
    return fail(500, "INTERNAL_ERROR", "Internal server error");
  }
}

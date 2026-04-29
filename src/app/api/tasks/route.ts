import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
  });

  return ok(tasks);
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

  const title = body.title?.trim();
  if (!title) {
    return fail(400, "BAD_REQUEST", "Title is required");
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: body.description?.trim() || null,
    },
  });

  return ok(task, 201);
}

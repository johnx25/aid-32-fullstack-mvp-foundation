import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: tasks });
}

export async function POST(request: Request) {
  let body: {
    title?: string;
    description?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 },
    );
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: body.description?.trim() || null,
    },
  });

  return NextResponse.json({ data: task }, { status: 201 });
}

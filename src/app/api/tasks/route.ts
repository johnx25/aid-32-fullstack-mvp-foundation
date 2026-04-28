import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: tasks });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    description?: string;
  };

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

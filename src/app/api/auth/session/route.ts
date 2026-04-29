import { fail, ok } from "@/lib/api-response";
import { requireCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true },
    });

    if (!user) {
      return fail(401, "UNAUTHORIZED", "Unauthorized");
    }

    return ok({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
    });
  } catch {
    return fail(401, "UNAUTHORIZED", "Unauthorized");
  }
}

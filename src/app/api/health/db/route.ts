import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api-response";
import { log } from "@/lib/logger";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return ok({
      status: "ok",
      database: "reachable",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    log("error", "health.db.unreachable", {
      reason: error instanceof Error ? error.message : "unknown",
    });

    return fail(503, "INTERNAL_ERROR", "Database is unreachable");
  }
}

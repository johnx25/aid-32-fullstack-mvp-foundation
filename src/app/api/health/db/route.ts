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
    const reason = error instanceof Error ? error.message : "unknown";
    const isDatabaseConfigError = reason.includes("DATABASE_URL");

    log("error", "health.db.unreachable", {
      reason,
    });

    return fail(
      503,
      isDatabaseConfigError ? "DATABASE_CONFIG_ERROR" : "INTERNAL_ERROR",
      isDatabaseConfigError
        ? "Database configuration is invalid"
        : "Database is unreachable"
    );
  }
}

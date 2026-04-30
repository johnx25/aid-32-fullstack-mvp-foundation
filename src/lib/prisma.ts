import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
const isNextBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!databaseUrl) {
  console.error(
    "[prisma] Missing required DATABASE_URL environment variable. Set DATABASE_URL before starting the app."
  );
  if (!isNextBuildPhase) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
}

if (databaseUrl?.includes("127.0.0.1")) {
  console.warn(
    "[prisma] DATABASE_URL points to 127.0.0.1. Expected a remote Supabase/Postgres connection in this environment."
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Prisma runtime.");
}

if (databaseUrl.includes("127.0.0.1")) {
  console.warn(
    "[db] DATABASE_URL points to 127.0.0.1. Use a reachable PostgreSQL/Supabase URL in deployed environments."
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

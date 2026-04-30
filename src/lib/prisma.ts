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

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Prisma runtime.");
  }

  if (databaseUrl.includes("127.0.0.1")) {
    console.warn(
      "[db] DATABASE_URL points to 127.0.0.1. Use a reachable PostgreSQL/Supabase URL in deployed environments."
    );
  }

  const client = new PrismaClient({
    log: ["warn", "error"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, receiver);

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
});

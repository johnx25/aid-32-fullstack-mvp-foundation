import { PrismaClient } from "@prisma/client";
import { hashSecret } from "../src/lib/secret-hash";

const seedDatabaseUrl =
  process.env.SEED_DATABASE_URL || process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!seedDatabaseUrl) {
  throw new Error(
    "No database URL available for seed. Set SEED_DATABASE_URL, DATABASE_URL, or DIRECT_URL."
  );
}
const resolvedSeedDatabaseUrl = seedDatabaseUrl;

const prisma = new PrismaClient({
  datasourceUrl: resolvedSeedDatabaseUrl,
});

function printSupabaseReachabilityHint(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const isReachabilityError =
    message.includes("P1001") || message.includes("Can't reach database server");
  const isSupabaseDirect = resolvedSeedDatabaseUrl.includes(".supabase.co:5432");

  if (!isReachabilityError || !isSupabaseDirect) {
    return;
  }

  console.error(
    [
      "Supabase direct host on port 5432 is often IPv6-only.",
      "If your environment has no IPv6 route, seed cannot reach db.<project-ref>.supabase.co:5432.",
      "Use a Supabase pooled URL for DATABASE_URL/SEED_DATABASE_URL,",
      "or enable Supabase dedicated IPv4 and keep DIRECT_URL for migrate commands.",
    ].join(" ")
  );
}

async function main() {
  const seedMode = process.env.SEED_MODE || "real";
  if (seedMode !== "demo") {
    console.info("Skipping demo users. Set SEED_MODE=demo to load test accounts.");
    return;
  }

  const users = [
    {
      email: "alice@example.com",
      displayName: "Alice",
      secret: "alice-secret",
      bio: "Runner and coffee fan",
      city: "Berlin",
      interests: "running,coffee,travel",
    },
    {
      email: "bob@example.com",
      displayName: "Bob",
      secret: "bob-secret",
      bio: "Guitarist and foodie",
      city: "Hamburg",
      interests: "music,food,hiking",
    },
    {
      email: "carol@example.com",
      displayName: "Carol",
      secret: "carol-secret",
      bio: "Designer and climber",
      city: "Munich",
      interests: "design,climbing,reading",
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        displayName: u.displayName,
        secretHash: hashSecret(u.secret),
        profile: {
          upsert: {
            update: { bio: u.bio, city: u.city, interests: u.interests },
            create: { bio: u.bio, city: u.city, interests: u.interests },
          },
        },
      },
      create: {
        email: u.email,
        displayName: u.displayName,
        secretHash: hashSecret(u.secret),
        profile: { create: { bio: u.bio, city: u.city, interests: u.interests } },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    printSupabaseReachabilityHint(error);
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

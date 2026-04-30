import { PrismaClient } from "@prisma/client";

const BASELINE_MIGRATION = "20260429150000_postgres_baseline";
const APP_TABLES = ["User", "Profile", "Like", "Match", "Message", "Task"];

const prisma = new PrismaClient();

async function tableExists(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public."${tableName}"')::text AS name`,
  );
  return Array.isArray(rows) && rows.length > 0 && rows[0]?.name === `public.${tableName}`;
}

async function isBaselineApplied() {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = $1 LIMIT 1`,
      BASELINE_MIGRATION,
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('relation "_prisma_migrations" does not exist')) {
      return false;
    }
    throw error;
  }
}

async function main() {
  const existing = [];
  for (const table of APP_TABLES) {
    if (await tableExists(table)) {
      existing.push(table);
    }
  }

  const baselineApplied = await isBaselineApplied();

  if (existing.length > 0 && !baselineApplied) {
    console.error(
      `[migration-guard] Existing app tables detected (${existing.join(", ")}), but baseline migration is not marked as applied.`,
    );
    console.error("[migration-guard] For existing environments, do not run migrate deploy directly.");
    console.error("[migration-guard] First verify schema compatibility, then run:");
    console.error(`  npx prisma migrate resolve --applied ${BASELINE_MIGRATION}`);
    console.error("[migration-guard] After that, run:");
    console.error("  npm run prisma:migrate:deploy");
    process.exit(1);
  }

  console.log("[migration-guard] PASS: migration target is safe (greenfield or baseline already applied).");
}

main()
  .catch((error) => {
    console.error("[migration-guard] Failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

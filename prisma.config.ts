import "dotenv/config";
import { defineConfig } from "prisma/config";

const supabaseUser = process.env.SUPABASE_DB_USER;
const supabasePassword = process.env.SUPABASE_DB_PASSWORD;
const supabaseProjectRef = process.env.SUPABASE_PROJECT_REF;
const supabasePoolerUrl = process.env.SUPABASE_POOLER_URL;
const supabaseDirectUrl = process.env.SUPABASE_DIRECT_URL;

if (supabasePoolerUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = supabasePoolerUrl;
}

if (supabaseDirectUrl && !process.env.DIRECT_URL) {
  process.env.DIRECT_URL = supabaseDirectUrl;
}
if (supabaseUser || supabasePassword || supabaseProjectRef) {
  if (!supabaseUser || !supabasePassword || !supabaseProjectRef) {
    throw new Error(
      "SUPABASE_DB_USER, SUPABASE_DB_PASSWORD, and SUPABASE_PROJECT_REF must all be set together."
    );
  }

  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = `postgresql://${supabaseUser}:${supabasePassword}@db.${supabaseProjectRef}.supabase.co:5432/postgres?schema=public`;
  }
}

const hasPlaceholderToken = (value: string | undefined) =>
  Boolean(value && (value.includes("USER") || value.includes("PASSWORD") || value.includes("PROJECT_REF")));
for (const [name, value] of Object.entries({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  MIGRATION_URL: process.env.MIGRATION_URL,
  SEED_DATABASE_URL: process.env.SEED_DATABASE_URL,
})) {
  if (hasPlaceholderToken(value)) {
    throw new Error(
      `${name} contains placeholder tokens (USER/PASSWORD/PROJECT_REF). Set a real Supabase/PostgreSQL URL.`
    );
  }
}

const isMigrateCommand = process.argv.some((arg) => arg.includes("migrate"));
const databaseUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_URL;

if (!isMigrateCommand && !process.env.DIRECT_URL && databaseUrl) {
  process.env.DIRECT_URL = databaseUrl;
}

if (isMigrateCommand) {
  if (!process.env.DIRECT_URL && migrationUrl) {
    process.env.DIRECT_URL = migrationUrl;
  }

  if (!process.env.DIRECT_URL && databaseUrl) {
    process.env.DIRECT_URL = databaseUrl;
  }

  if (!process.env.DIRECT_URL) {
    throw new Error(
      "No migration connection URL found. Set DIRECT_URL, MIGRATION_URL, or DATABASE_URL for Prisma migrate commands."
    );
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});

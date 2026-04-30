import "dotenv/config";
import { defineConfig } from "prisma/config";

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

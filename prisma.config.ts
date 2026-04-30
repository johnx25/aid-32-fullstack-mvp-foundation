import "dotenv/config";
import { defineConfig } from "prisma/config";

const isMigrateCommand = process.argv.some((arg) => arg.includes("migrate"));
const databaseUrl = process.env.DATABASE_URL;

if (!isMigrateCommand && !process.env.DIRECT_URL && databaseUrl) {
  process.env.DIRECT_URL = databaseUrl;
}

if (isMigrateCommand && !process.env.DIRECT_URL) {
  throw new Error(
    "DIRECT_URL is required for Prisma migrate commands. Set DIRECT_URL to a direct PostgreSQL connection string."
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations_postgres",
  },
});

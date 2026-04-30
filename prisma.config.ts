import "dotenv/config";
import { defineConfig } from "prisma/config";

const isMigrateCommand = process.argv.some((arg) => arg.includes("migrate"));

if (isMigrateCommand && !process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for Prisma migrate commands. Set DATABASE_URL to a PostgreSQL connection string."
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations_postgres",
  },
});

/**
 * apply-migration.mjs
 *
 * Applies the baseline Postgres migration statement-by-statement via Prisma.
 * Use this when DIRECT_URL is not reachable from the environment (e.g. IPv4-only VPS)
 * and Prisma migrate deploy / push are blocked.
 *
 * Usage:
 *   node scripts/apply-migration.mjs
 *
 * Requires DATABASE_URL to be set in .env or environment.
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import 'dotenv/config';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(__dirname, '../prisma/migrations_postgres/20260429150000_postgres_baseline/migration.sql');

const prisma = new PrismaClient();

async function main() {
  const sql = readFileSync(migrationPath, 'utf8');

  const stmts = sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 5);

  console.log(`Running ${stmts.length} statements...`);

  for (const stmt of stmts) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`✓ ${stmt.slice(0, 80).replace(/\n/g, ' ')}`);
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('duplicate')) {
        console.log(`- SKIP (exists): ${stmt.slice(0, 60).replace(/\n/g, ' ')}`);
      } else {
        console.error(`✗ ERROR: ${e.message.slice(0, 120)}`);
      }
    }
  }

  const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;`;
  console.log(`\nTables: ${tables.map(t => t.tablename).join(', ')}`);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());

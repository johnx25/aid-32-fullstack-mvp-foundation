#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[migration-guard] DATABASE_URL is required"
  exit 1
fi

node scripts/verify-migration-target.mjs

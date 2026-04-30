#!/usr/bin/env bash
set -euo pipefail

source ./scripts/resolve-db-env.sh

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required"
  exit 1
fi

MIGRATION_URL="${MIGRATION_URL:-${DIRECT_URL:-${DATABASE_URL}}}"
export DIRECT_URL="${DIRECT_URL:-${MIGRATION_URL}}"

PORT="${INTEGRATION_PORT:-3210}"
BASE_URL="http://127.0.0.1:${PORT}"
APP_PID=""
HEALTH_OK="false"
START_LOG="$(mktemp /tmp/aid32-start.XXXXXX.log)"
HEALTH_JSON="$(mktemp /tmp/aid32-health.XXXXXX.json)"

ensure_migration_target() {
  local migration_url="${1}"
  local database_url="${2}"
  local fallback_allowed="${ALLOW_MIGRATION_URL_FALLBACK:-1}"

  if [ -z "${migration_url}" ]; then
    echo "ERROR: No migration URL resolved. Set DIRECT_URL, MIGRATION_URL, or DATABASE_URL."
    exit 1
  fi

  if MIGRATION_TARGET_URL="${migration_url}" node -e '
const target = process.env.MIGRATION_TARGET_URL;
const parsed = new URL(target);
const socket = require("net").createConnection({
  host: parsed.hostname,
  port: Number(parsed.port || 5432),
  timeout: 4000,
});
socket.on("connect", () => { socket.end(); process.exit(0); });
socket.on("timeout", () => { socket.destroy(); process.exit(1); });
socket.on("error", () => process.exit(1));
'; then
    echo "[integration] migration connection target is reachable"
    export DIRECT_URL="${migration_url}"
    return
  fi

  echo "[integration] WARN: migration target is not reachable"
  if [ "${fallback_allowed}" != "1" ]; then
    echo "ERROR: Migration target reachability check failed and fallback is disabled (ALLOW_MIGRATION_URL_FALLBACK=${fallback_allowed})."
    exit 1
  fi

  if [ "${migration_url}" = "${database_url}" ]; then
    echo "ERROR: Migration URL matches DATABASE_URL and is unreachable. Provide reachable DIRECT_URL or MIGRATION_URL."
    exit 1
  fi

  if MIGRATION_TARGET_URL="${database_url}" node -e '
const target = process.env.MIGRATION_TARGET_URL;
const parsed = new URL(target);
const socket = require("net").createConnection({
  host: parsed.hostname,
  port: Number(parsed.port || 5432),
  timeout: 4000,
});
socket.on("connect", () => { socket.end(); process.exit(0); });
socket.on("timeout", () => { socket.destroy(); process.exit(1); });
socket.on("error", () => process.exit(1));
'; then
    echo "[integration] Using DATABASE_URL as migration target fallback"
    export DIRECT_URL="${database_url}"
    return
  fi

  echo "ERROR: Neither migration URL nor DATABASE_URL is reachable from this runner."
  exit 1
}

cleanup() {
  if [ -n "${APP_PID}" ] && kill -0 "${APP_PID}" >/dev/null 2>&1; then
    kill "${APP_PID}" >/dev/null 2>&1 || true
    wait "${APP_PID}" >/dev/null 2>&1 || true
  fi
  rm -f "${START_LOG}" "${HEALTH_JSON}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[integration] prisma generate"
npm run prisma:generate

echo "[integration] prisma validate"
npx prisma validate

echo "[integration] resolve migration target"
ensure_migration_target "${MIGRATION_URL}" "${DATABASE_URL}"

echo "[integration] migration target guard"
bash scripts/verify-migration-target.sh

echo "[integration] prisma migrate deploy"
npm run prisma:migrate:deploy

echo "[integration] prisma seed (demo mode)"
SEED_MODE=demo npm run prisma:seed

echo "[integration] next build"
npm run build

echo "[integration] start app on ${BASE_URL}"
PORT="${PORT}" npm run start >"${START_LOG}" 2>&1 &
APP_PID="$!"

for _ in $(seq 1 40); do
  if curl -fsS "${BASE_URL}/api/health/db" >"${HEALTH_JSON}" 2>/dev/null; then
    HEALTH_OK="true"
    break
  fi
  sleep 1
done

if [ "${HEALTH_OK}" != "true" ] || ! grep -q '"status":"ok"' "${HEALTH_JSON}"; then
  echo "ERROR: Health response is not ok"
  echo "--- ${HEALTH_JSON} ---"
  cat "${HEALTH_JSON}" || true
  echo "--- ${START_LOG} ---"
  tail -n 200 "${START_LOG}" || true
  exit 1
fi

echo "[integration] PASS: migrated Supabase/PostgreSQL DB flow is healthy"

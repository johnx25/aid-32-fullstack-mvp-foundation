#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required"
  exit 1
fi

if [ -z "${DIRECT_URL:-}" ]; then
  echo "ERROR: DIRECT_URL is required"
  exit 1
fi

PORT="${INTEGRATION_PORT:-3210}"
BASE_URL="http://127.0.0.1:${PORT}"
APP_PID=""
HEALTH_OK="false"

cleanup() {
  if [ -n "${APP_PID}" ] && kill -0 "${APP_PID}" >/dev/null 2>&1; then
    kill "${APP_PID}" >/dev/null 2>&1 || true
    wait "${APP_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "[integration] prisma generate"
npm run prisma:generate

echo "[integration] prisma validate"
npx prisma validate

echo "[integration] prisma migrate deploy"
npm run prisma:migrate:deploy

echo "[integration] prisma seed (demo mode)"
SEED_MODE=demo npm run prisma:seed

echo "[integration] next build"
npm run build

echo "[integration] start app on ${BASE_URL}"
PORT="${PORT}" npm run start >/tmp/aid32-start.log 2>&1 &
APP_PID="$!"
rm -f /tmp/aid32-health.json

for _ in $(seq 1 40); do
  if curl -fsS "${BASE_URL}/api/health/db" >/tmp/aid32-health.json 2>/dev/null; then
    HEALTH_OK="true"
    break
  fi
  sleep 1
done

if [ "${HEALTH_OK}" != "true" ] || ! grep -q '"status":"ok"' /tmp/aid32-health.json; then
  echo "ERROR: Health response is not ok"
  echo "--- /tmp/aid32-health.json ---"
  cat /tmp/aid32-health.json || true
  echo "--- /tmp/aid32-start.log ---"
  tail -n 200 /tmp/aid32-start.log || true
  exit 1
fi

echo "[integration] PASS: migrated Supabase/PostgreSQL DB flow is healthy"

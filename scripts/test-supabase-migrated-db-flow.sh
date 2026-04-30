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
START_LOG="$(mktemp /tmp/aid32-start.XXXXXX.log)"
HEALTH_JSON="$(mktemp /tmp/aid32-health.XXXXXX.json)"

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

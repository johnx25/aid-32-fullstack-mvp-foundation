#!/usr/bin/env bash
set -euo pipefail

if [ -n "${SUPABASE_POOLER_URL:-}" ] && [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="${SUPABASE_POOLER_URL}"
fi

if [ -n "${SUPABASE_DIRECT_URL:-}" ] && [ -z "${DIRECT_URL:-}" ]; then
  export DIRECT_URL="${SUPABASE_DIRECT_URL}"
fi

if [ -n "${SUPABASE_DB_USER:-}" ] || [ -n "${SUPABASE_DB_PASSWORD:-}" ] || [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
  if [ -z "${SUPABASE_DB_USER:-}" ] || [ -z "${SUPABASE_DB_PASSWORD:-}" ] || [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
    echo "ERROR: SUPABASE_DB_USER, SUPABASE_DB_PASSWORD, and SUPABASE_PROJECT_REF must all be set together."
    exit 1
  fi

  if [ -z "${DIRECT_URL:-}" ]; then
    export DIRECT_URL="postgresql://${SUPABASE_DB_USER}:${SUPABASE_DB_PASSWORD}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres?schema=public"
  fi

fi

validate_url_var() {
  local var_name="$1"
  local value="${!var_name:-}"

  if [ -z "${value}" ]; then
    return
  fi

  if [[ "${value}" == *"USER"* ]] || [[ "${value}" == *"PASSWORD"* ]] || [[ "${value}" == *"PROJECT_REF"* ]]; then
    echo "ERROR: ${var_name} contains placeholder tokens (USER/PASSWORD/PROJECT_REF). Set a real Supabase/PostgreSQL URL."
    exit 1
  fi

  if [[ "${value}" != postgresql://* ]] && [[ "${value}" != postgres://* ]]; then
    echo "ERROR: ${var_name} must be a postgres URL (postgresql://... or postgres://...)."
    exit 1
  fi
}

validate_url_var "DATABASE_URL"
validate_url_var "DIRECT_URL"
validate_url_var "MIGRATION_URL"
validate_url_var "SEED_DATABASE_URL"

if [ -n "${MIGRATION_URL:-}" ] && [ -z "${DIRECT_URL:-}" ]; then
  export DIRECT_URL="${MIGRATION_URL}"
fi

if [ -n "${DATABASE_URL:-}" ] && [ -z "${DIRECT_URL:-}" ]; then
  export DIRECT_URL="${DATABASE_URL}"
fi

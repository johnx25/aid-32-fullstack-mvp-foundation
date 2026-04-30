#!/usr/bin/env bash
set -euo pipefail

load_env_file() {
  local env_file="$1"
  if [ -f "${env_file}" ]; then
    local had_database_url="${DATABASE_URL+x}"
    local had_direct_url="${DIRECT_URL+x}"
    local had_migration_url="${MIGRATION_URL+x}"
    local had_migration_fallback_url="${MIGRATION_FALLBACK_URL+x}"
    local had_seed_database_url="${SEED_DATABASE_URL+x}"
    local had_supabase_pooler_url="${SUPABASE_POOLER_URL+x}"
    local had_supabase_direct_url="${SUPABASE_DIRECT_URL+x}"

    local prev_database_url="${DATABASE_URL:-}"
    local prev_direct_url="${DIRECT_URL:-}"
    local prev_migration_url="${MIGRATION_URL:-}"
    local prev_migration_fallback_url="${MIGRATION_FALLBACK_URL:-}"
    local prev_seed_database_url="${SEED_DATABASE_URL:-}"
    local prev_supabase_pooler_url="${SUPABASE_POOLER_URL:-}"
    local prev_supabase_direct_url="${SUPABASE_DIRECT_URL:-}"

    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a

    # Keep runner-provided env values authoritative over .env defaults.
    if [ -n "${had_database_url}" ]; then export DATABASE_URL="${prev_database_url}"; fi
    if [ -n "${had_direct_url}" ]; then export DIRECT_URL="${prev_direct_url}"; fi
    if [ -n "${had_migration_url}" ]; then export MIGRATION_URL="${prev_migration_url}"; fi
    if [ -n "${had_migration_fallback_url}" ]; then export MIGRATION_FALLBACK_URL="${prev_migration_fallback_url}"; fi
    if [ -n "${had_seed_database_url}" ]; then export SEED_DATABASE_URL="${prev_seed_database_url}"; fi
    if [ -n "${had_supabase_pooler_url}" ]; then export SUPABASE_POOLER_URL="${prev_supabase_pooler_url}"; fi
    if [ -n "${had_supabase_direct_url}" ]; then export SUPABASE_DIRECT_URL="${prev_supabase_direct_url}"; fi
  fi
}

load_env_file ".env"
load_env_file ".env.local"

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
validate_url_var "MIGRATION_FALLBACK_URL"
validate_url_var "SEED_DATABASE_URL"

if [ -n "${MIGRATION_URL:-}" ] && [ -z "${DIRECT_URL:-}" ]; then
  export DIRECT_URL="${MIGRATION_URL}"
fi

if [ -n "${DATABASE_URL:-}" ] && [ -z "${DIRECT_URL:-}" ]; then
  export DIRECT_URL="${DATABASE_URL}"
fi

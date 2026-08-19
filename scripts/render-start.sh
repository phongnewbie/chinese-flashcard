#!/usr/bin/env bash
set -euo pipefail

pick_data_dir() {
  local configured="${DATA_DIR:-}"
  if [ -n "$configured" ]; then
    if mkdir -p "$configured/uploads/images" "$configured/uploads/audio" 2>/dev/null; then
      echo "$configured"
      return
    fi
    echo "WARN: Cannot write to DATA_DIR=$configured — uploads may use ./data fallback." >&2
  fi
  local fallback
  fallback="$(pwd)/data"
  mkdir -p "$fallback/uploads/images" "$fallback/uploads/audio"
  echo "$fallback"
}

DATA_ROOT="$(pick_data_dir)"
export DATA_DIR="$DATA_ROOT"
export UPLOAD_DIR="${UPLOAD_DIR:-${DATA_ROOT}/uploads}"

# Neon/Postgres: giữ DATABASE_URL từ Render env. SQLite fallback khi chưa set.
if [ -z "${DATABASE_URL:-}" ] || [[ "${DATABASE_URL}" == file:* ]]; then
  export DATABASE_URL="file:${DATA_ROOT}/app.db"
fi

echo "=== Render start ==="
echo "DATA_DIR=$DATA_DIR"
echo "UPLOAD_DIR=$UPLOAD_DIR"
if [[ "${DATABASE_URL}" == postgres* ]]; then
  echo "DATABASE=PostgreSQL (Neon/cloud)"
else
  echo "DATABASE_URL=$DATABASE_URL"
fi

npx prisma migrate deploy

if [[ "${DATABASE_URL}" != postgres* ]]; then
  DB_FILE="${DATA_ROOT}/app.db"
  if [ -f "$DB_FILE" ]; then
    DB_KB=$(( $(stat -c%s "$DB_FILE" 2>/dev/null || stat -f%z "$DB_FILE" 2>/dev/null || echo 0) / 1024 ))
    echo "SQLite OK: $DB_FILE (${DB_KB} KB)"
  fi
fi

exec npm start

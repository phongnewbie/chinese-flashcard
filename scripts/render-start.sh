#!/usr/bin/env bash
set -euo pipefail

pick_data_dir() {
  local configured="${DATA_DIR:-}"
  if [ -n "$configured" ]; then
    if mkdir -p "$configured/uploads/images" "$configured/uploads/audio" 2>/dev/null; then
      echo "$configured"
      return
    fi
    echo "WARN: Cannot write to DATA_DIR=$configured (add Render disk at /var/data?). Using ./data fallback." >&2
  fi
  local fallback
  fallback="$(pwd)/data"
  mkdir -p "$fallback/uploads/images" "$fallback/uploads/audio"
  echo "$fallback"
}

DATA_ROOT="$(pick_data_dir)"
export DATA_DIR="$DATA_ROOT"
export DATABASE_URL="file:${DATA_ROOT}/app.db"
export UPLOAD_DIR="${DATA_ROOT}/uploads"

echo "Starting with DATA_DIR=$DATA_DIR"
npx prisma migrate deploy
exec npm start

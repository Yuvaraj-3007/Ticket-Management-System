#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[startup] FATAL: DATABASE_URL is not set. Exiting."
  exit 1
fi

echo "[startup] Running database migrations..."
cd /app/server && bunx prisma migrate deploy

echo "[startup] Seeding admin user..."
cd /app/server && bun run prisma/seed.ts

echo "[startup] Starting server..."
exec bun run /app/server/src/index.ts

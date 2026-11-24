#!/bin/sh
# Production start: apply committed migrations, then boot the API.
# Never runs `prisma db push` or the seed.
set -eu

cd "$(dirname "$0")/.."

echo "Applying committed Prisma migrations (migrate deploy)."
echo "This does not run db push and does not seed."

if ! npx prisma migrate deploy; then
  cat <<'EOF' >&2

ERROR: prisma migrate deploy failed. The API was not started.
No seed ran. migrate deploy does not drop columns to force a match.

If the error is P3005 (database schema is not empty), this database was created
with `prisma db push` and has no migration history. Prisma stopped before running
SQL and did not change tables or rows. After a backup and a drift check:
  BASELINE_CONFIRM=yes npm run db:baseline
Then redeploy or restart. That command only records 20251124000000_baseline as
already applied. It does not execute migration.sql.

Do not run `prisma db push` or `npm run db:seed` against production.
EOF
  exit 1
fi

echo "Migrations applied. Starting API."
exec npx tsx src/index.ts

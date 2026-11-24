#!/bin/sh
# Record the baseline migration as already applied. Does not execute SQL.
# Use only on a database that already matches prisma/schema.prisma (the old db push database).
set -eu

cd "$(dirname "$0")/.."

if [ "${BASELINE_CONFIRM:-}" != "yes" ]; then
  cat <<'EOF' >&2
This marks 20251124000000_baseline as already applied.
It does not run SQL and it does not seed.

Use it only on a database that already has this schema (production was created with prisma db push).
Do not use it on an empty database. An empty database should run: npm run db:setup

Take a backup first. Then re-run with BASELINE_CONFIRM=yes.
EOF
  exit 1
fi

exec npx prisma migrate resolve --applied 20251124000000_baseline

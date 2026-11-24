#!/bin/sh
# Drop the local database, reapply migrations, and run the seed. Never for production.
set -eu

cd "$(dirname "$0")/.."

if [ "${NODE_ENV:-}" = "production" ]; then
  echo "Refusing db:reset while NODE_ENV=production. This command drops the database." >&2
  exit 1
fi

exec npx prisma migrate reset --force

import { prismaExitCode, runTsx } from "./cli.js";

console.log("Applying committed Prisma migrations (migrate deploy).");
console.log("This does not run db push and does not seed.");

const code = prismaExitCode(["migrate", "deploy"]);
if (code !== 0) {
  console.error(`
ERROR: prisma migrate deploy failed. The API was not started.
No seed ran. migrate deploy does not drop columns to force a match.

If the error is P3005 (database schema is not empty), this database was created
with prisma db push and has no migration history. Prisma stopped before running
SQL and did not change tables or rows. After a backup and a drift check:

PowerShell:
  $env:BASELINE_CONFIRM="yes"; npm run db:baseline

bash:
  BASELINE_CONFIRM=yes npm run db:baseline

Then redeploy or restart. That command only records 20251124000000_baseline as
already applied. It does not execute migration.sql.

Do not run prisma db push or npm run db:seed against production.`);
  process.exit(code);
}

console.log("Migrations applied. Starting API.");
runTsx("src/index.ts");

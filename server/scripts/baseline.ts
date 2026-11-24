import { runPrisma } from "./cli.js";

if (process.env.BASELINE_CONFIRM !== "yes") {
  console.error(`This marks 20251124000000_baseline as already applied.
It does not run SQL and it does not seed.

Use it only on a database that already has this schema.
Do not use it on an empty database. An empty database should run: npm run db:setup

Take a backup first.

PowerShell:
  $env:BASELINE_CONFIRM="yes"; npm run db:baseline

bash:
  BASELINE_CONFIRM=yes npm run db:baseline`);
  process.exit(1);
}

runPrisma(["migrate", "resolve", "--applied", "20251124000000_baseline"]);

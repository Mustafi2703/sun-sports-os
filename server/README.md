# Sun Sports API

Express 5 API for Sun Sports SportsOS. Prisma 6 and PostgreSQL. The frontend is the repo root and deploys on Vercel. This service deploys on Railway from `Dockerfile` and `railway.toml`.

Production start applies committed migrations with `prisma migrate deploy`, then boots the API. It does not run `prisma db push`, `--accept-data-loss`, or the seed.

## Environment variables

Set these in the environment. Names only. Do not commit values.

Required:

- `DATABASE_URL` - PostgreSQL connection string Prisma uses

Runtime names the API also reads:

- `PORT`
- `NODE_ENV`
- `CORS_ORIGINS`
- `JWT_SECRET`
- `DEFAULT_PIN`
- `ADMIN_PHONE`
- `ADMIN_EMAIL`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `OTP_DEV_ECHO`
- `OTP_TTL_SECONDS`
- `AUTH_ALLOW_PIN`
- `SMS_PROVIDER`
- `MSG91_AUTH_KEY`
- `MSG91_TEMPLATE_ID`
- `MSG91_PIN_TEMPLATE_ID`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM`

Seed opt-in, staging only. Do not set this on the production Railway service:

- `ALLOW_SEED` - must be `true` to run the seed when `NODE_ENV=production`

One-time baseline confirmation. Not a Railway variable. Set it only for the baseline command:

- `BASELINE_CONFIRM` - must be `yes`

## Local setup

From `server/`, with `DATABASE_URL` pointing at a local empty database. You can export it or put it in `server/.env` (that file is not committed):

```bash
npm install
npm run db:setup
npm run dev
```

`db:setup` generates the Prisma client, applies committed migrations (`prisma migrate deploy`), and runs the seed once.

The API listens on port 4000 unless `PORT` is set. Health check: `GET /api/health`.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | API with reload. Does not migrate or seed. |
| `npm run db:setup` | Generate client, `migrate deploy`, seed. Local empty database. |
| `npm run db:migrate` | `prisma migrate dev`. Creates a new migration from `schema.prisma` and applies it locally. |
| `npm run db:migrate:deploy` | `prisma migrate deploy`. Applies pending committed migrations. This is what production runs. |
| `npm run db:migrate:status` | Shows applied and pending migrations. |
| `npm run db:seed` | Manual seed. Inserts demo roster only when students, coaches, and batches are all empty. |
| `npm run db:reset` | Local only. Drops the database, reapplies migrations, and seeds. Refuses when `NODE_ENV=production`. |
| `npm run db:baseline` | One-time. Marks the baseline migration applied without running SQL. Requires `BASELINE_CONFIRM=yes`. |
| `npm run build` | Typecheck and compile `src/` to `dist/`. |
| `npm run start:prod` | Same path Railway uses: `migrate deploy`, then the API. |

`prisma migrate dev` is for local development. Do not point it at production. If it reports drift it may offer to reset the database.

`npm run db:reset` deletes every row in the database it is pointed at. Use it only on a local database.

## Create a migration

1. Edit `prisma/schema.prisma`.
2. From `server/`, with `DATABASE_URL` set to a local database:

```bash
npx prisma migrate dev --name describe_the_change
```

3. Commit `prisma/schema.prisma` and the new folder under `prisma/migrations/`.

`migrate dev` creates SQL and applies it locally. Review the SQL before committing. Prefer additive changes (new tables, new nullable columns, new indexes). A migration that drops a column or table will do that in production when it is deployed. `migrate deploy` will not invent extra drops, and it will not pass `--accept-data-loss`, but it will run the SQL you committed.

## How deploys apply migrations

Railway builds `server/Dockerfile`. The container command is `scripts/start-prod.sh`:

1. `npx prisma migrate deploy`
2. If that exits non-zero, the API does not start and the seed does not run.
3. If it succeeds, `npx tsx src/index.ts` starts the API.

`migrate deploy` only runs migration files that are not yet in `_prisma_migrations`. It does not compare the live database to `schema.prisma` and it does not drop objects to make them match.

There is no Railway `startCommand` override. Do not add one that runs `db push` or the seed.

## One-time production baseline

Production already has real academy data, and its tables were created by `prisma db push`, so there is no `_prisma_migrations` history. The committed migration `20251124000000_baseline` is the full schema from `prisma/schema.prisma`. Running that SQL on production would fail because the tables already exist, and it must not be executed there.

Do this once, against production, before the new image stays up. Take a backup first.

### 1. Back up the database

In Railway, open the Postgres service and take a backup (or run `pg_dump` from a trusted machine). Confirm you know how to restore it before continuing. This step is required even though the baseline command itself does not change tables or rows.

### 2. Confirm the live schema matches `schema.prisma`

From `server/`, with `DATABASE_URL` set to the production database (do not commit it, do not print it):

```bash
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code
```

Exit code 0 means Prisma sees no drift. If it prints a diff, stop. Do not baseline and do not deploy this change until someone has reviewed that diff. Missing columns on the live database would not be added by a baseline that is only marked as applied. Extra objects would be left in place, and the next authored migration could be wrong.

### 3. Mark the baseline as already applied

Still from `server/`, same production `DATABASE_URL`:

```bash
BASELINE_CONFIRM=yes npm run db:baseline
npx prisma migrate status
```

`db:baseline` runs `prisma migrate resolve --applied 20251124000000_baseline`. It inserts a row into `_prisma_migrations`. It does not execute `migration.sql`, does not alter tables, and does not seed.

`migrate status` should report the baseline as applied and no pending migrations.

Do not run `db:baseline` on an empty database. An empty database should use `npm run db:setup` or `npm run db:migrate:deploy`, which actually runs the SQL.

### 4. Deploy

Merge and let Railway deploy. The new container runs `migrate deploy`, sees the baseline, applies nothing else, and starts the API.

You can baseline before the merge, from a checkout of this branch, as long as `DATABASE_URL` points at production. That is the preferred order: the new container then starts cleanly on the first boot.

### If the new container already failed on boot

On a database that already has tables and has no `_prisma_migrations` table, Prisma 6 stops with error **P3005** ("The database schema is not empty") before it runs `migration.sql`. It does not create the migrations table and it does not change rows. The API process then exits, so the seed does not run either.

From a checkout of this release, with production `DATABASE_URL`:

```bash
BASELINE_CONFIRM=yes npm run db:baseline
```

Then redeploy or restart. `migrate status` should say the database is up to date.

The production image contains the Prisma CLI, so a Railway one-off command in the new image can run the same baseline command (`BASELINE_CONFIRM=yes npm run db:baseline`, or `npx prisma migrate resolve --applied 20251124000000_baseline`). Do not one-off `db push` or the seed.

A later migration that fails while executing SQL is a different case. Prisma records that migration as failed. Fix or roll back that migration with `npx prisma migrate resolve --rolled-back <migration_folder_name>` before deploying again. Do not use `--rolled-back` for the P3005 baseline case above. Nothing was recorded.

## Seeding

`npm run db:seed` is manual. Production boot does not call it.

Behavior:

- When `NODE_ENV=production`, the script exits with an error unless `ALLOW_SEED=true`. Do not set that on production. Staging that runs with `NODE_ENV=production` can set it for a one-off manual seed.
- If any student, coach, or batch already exists, the script returns without inserting, updating, or deleting rows.
- It does not call `deleteMany`. An empty roster is the only case that inserts the demo academy (if missing), coaches, one batch, demo students, and portal users.
- Re-running it after a successful seed does nothing to those rows. Edits you made are left as they are.

`npm run db:reset` runs this seed after rebuilding a local database. The command is configured in `prisma.config.ts` (`migrations.seed`).

Prisma commands load `server/.env` through that config file. Do not commit `.env`. On Railway, `DATABASE_URL` comes from the service environment, not from a file.

## Risky behavior left unchanged

These are not part of the migration setup. They can still change or delete academy data. They were left as they are on purpose.

1. Excel import replace mode. `POST /api/import/excel` with form field `mode=replace` (admin auth) deletes every attendance record, fee payment, coach note, student, batch, and coach, then imports the workbook. Student deletes cascade to fee enrollments and installments. The Settings screen currently always sends `mode=upsert`, which does not wipe those tables. Upsert still overwrites dob, age, parent fields, role, join date, medical notes, and batch for a student whose name matches. The replace path is still live on the API for any client that posts it.

2. Startup deletes in `src/index.ts`. Every boot deletes enquiries whose parent name is `Sample Parent`, and fee payments whose note is `Monthly HP fee`. A real payment stored with that note is removed on the next restart. This is not the seed script.

3. Startup fee packages. `ensureDefaultFeePackages()` runs on every boot and overwrites the name, description, monthly amount, total, and active flag of the earliest fee package for 1, 3, 6, and 12 months. A custom price on those packages is reset.

4. Startup portal users. `bootstrapPortalUsers()` runs on every boot. It does not reset PIN hashes. It does rewrite the admin user's name, updates coach and parent user names and emails, and normalizes stored phone strings on students and coaches.

5. Head coach flag. `ensureHeadCoachFlags()` sets `isHeadCoach` on coaches whose name contains "Harry" or whose specialty contains "Head Coach" when the flag is still false.

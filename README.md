# Sun Sports — SportsOS

Academy management platform for **Sun Sports** High Performance cricket (custom build by QRYX Tech).

## Stack

- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Recharts
- Excel import via SheetJS (`xlsx`)

## Modules (Phase 1 demo)

- Admin dashboard
- Students CRM
- Batches & schedule
- Fee management
- Attendance
- Performance tracking
- Parent portal & coach dashboard
- Communications, tournaments, reports
- Settings with **Excel data upload**

## Seed data

Bundled roster: [`public/data/sun-sports-students-2026.xlsx`](public/data/sun-sports-students-2026.xlsx)

Sheets expected:

1. `Student Data Entry`
2. `Coaches`
3. `Batches` (or `Bathches`)

Import again anytime from **Settings → Data import**.

## Develop

```bash
npm install
npm run dev
```

App: http://localhost:8080  
Console: http://localhost:8080/app

## API and database

The API lives in [`server/`](server/). Production boots with `prisma migrate deploy` and does not run `db push` or the seed.

Local database setup, migration workflow, environment variable names, and the one-time production baseline (take a backup first) are in [`server/README.md`](server/README.md).

## Build

```bash
npm run build
npm run preview
```

## Branding

Professional Sun Sports SportsOS branding — no third-party builder logos.

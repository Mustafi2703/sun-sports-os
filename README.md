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

## Build

```bash
npm run build
npm run preview
```

## Branding

Professional Sun Sports SportsOS branding — no third-party builder logos.

// Prisma skips its own .env load when this file is present. Load server/.env
// for local commands. Variables already set in the process (Railway) are kept.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});

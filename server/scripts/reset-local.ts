import { runPrisma } from "./cli.js";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing db:reset while NODE_ENV=production. This command drops the database.");
  process.exit(1);
}

console.error("db:reset drops every table in DATABASE_URL, reapplies migrations, and runs the seed.");
console.error("Use it only on a local database.");
runPrisma(["migrate", "reset", "--force"]);

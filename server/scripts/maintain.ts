/**
 * One-time maintenance. Prints the plan and changes nothing unless MAINTAIN_CONFIRM=yes.
 * When NODE_ENV=production, writes also require ALLOW_MAINTAIN=yes.
 *
 * PowerShell:
 *   npm run db:maintain -- cleanup-demo-rows
 *   $env:MAINTAIN_CONFIRM="yes"; npm run db:maintain -- cleanup-demo-rows
 *
 * bash:
 *   npm run db:maintain -- cleanup-demo-rows
 *   MAINTAIN_CONFIRM=yes npm run db:maintain -- cleanup-demo-rows
 */
import { prisma } from "../src/lib/prisma.js";
import { bootstrapPortalUsers } from "../src/lib/bootstrapUsers.js";
import { applyFeePackageAmountSync, previewFeePackageAmountSync } from "../src/lib/feeSync.js";
import { recomputeAttendancePctMany } from "../src/lib/attendance.js";

const action = process.argv[2] || "";
const write = process.env.MAINTAIN_CONFIRM === "yes";

function assertWriteAllowed() {
  if (!write) {
    console.log("Dry run only. No rows were changed. Set MAINTAIN_CONFIRM=yes to apply.");
    return false;
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MAINTAIN !== "yes") {
    console.error("Refusing to write while NODE_ENV=production. Set ALLOW_MAINTAIN=yes as well as MAINTAIN_CONFIRM=yes.");
    process.exit(1);
  }
  return true;
}

async function cleanupDemoRows() {
  const enquiries = await prisma.enquiry.count({ where: { parentName: "Sample Parent" } });
  const payments = await prisma.feePayment.count({ where: { note: "Monthly HP fee" } });
  console.log(`Enquiries named Sample Parent: ${enquiries}`);
  console.log(`Fee payments noted Monthly HP fee: ${payments}`);
  if (!assertWriteAllowed()) return;
  const removedEnquiries = await prisma.enquiry.deleteMany({ where: { parentName: "Sample Parent" } });
  const removedPayments = await prisma.feePayment.deleteMany({ where: { note: "Monthly HP fee" } });
  console.log(`Deleted enquiries: ${removedEnquiries.count}. Deleted payments: ${removedPayments.count}.`);
}

async function syncFeePackages() {
  const plan = await previewFeePackageAmountSync();
  if (plan.length === 0) console.log("Fee packages already match the built-in amounts, or none of those durations exist yet.");
  for (const row of plan) console.log(JSON.stringify(row));
  if (!assertWriteAllowed()) return;
  const applied = await applyFeePackageAmountSync();
  console.log(`Updated or created ${applied} fee package rows.`);
}

async function syncPortalUsers() {
  console.log("This creates missing portal users and refreshes names and emails. It does not reset PIN hashes.");
  if (!assertWriteAllowed()) {
    console.log("Dry run cannot list every name change without reading the same rows the write uses. Re-run with MAINTAIN_CONFIRM=yes to apply.");
    return;
  }
  await bootstrapPortalUsers({ syncExisting: true });
}

async function headCoachFlags() {
  const coaches = await prisma.coach.findMany({
    where: {
      OR: [
        { name: { contains: "Harry", mode: "insensitive" } },
        { specialty: { contains: "Head Coach", mode: "insensitive" } },
      ],
      isHeadCoach: false,
    },
    select: { id: true, name: true, specialty: true },
  });
  console.log(`Coaches that would be marked head coach: ${coaches.length}`);
  for (const coach of coaches) console.log(`${coach.name} (${coach.specialty || "no specialty"})`);
  if (!assertWriteAllowed()) return;
  const result = await prisma.coach.updateMany({
    where: { id: { in: coaches.map((c) => c.id) } },
    data: { isHeadCoach: true },
  });
  console.log(`Updated ${result.count} coaches.`);
}

async function recomputeAttendance() {
  const ids = (await prisma.student.findMany({ select: { id: true } })).map((s) => s.id);
  console.log(`Students whose attendance percent would be recomputed from records: ${ids.length}`);
  if (!assertWriteAllowed()) return;
  await recomputeAttendancePctMany(ids);
  console.log(`Recomputed attendance percent for ${ids.length} students.`);
}

const actions: Record<string, () => Promise<void>> = {
  "cleanup-demo-rows": cleanupDemoRows,
  "sync-fee-packages": syncFeePackages,
  "sync-portal-users": syncPortalUsers,
  "head-coach-flags": headCoachFlags,
  "recompute-attendance": recomputeAttendance,
};

const run = actions[action];
if (!run) {
  console.error(`Usage: npm run db:maintain -- <action>

Actions:
  cleanup-demo-rows     Delete Sample Parent enquiries and Monthly HP fee payments
  sync-fee-packages     Rewrite 1/3/6/12 month package amounts to the built-in prices
  sync-portal-users     Create missing portal users and refresh names and emails
  head-coach-flags      Set isHeadCoach on Harry or Head Coach specialty
  recompute-attendance  Set each student's attendance percent from saved marks

Writes require MAINTAIN_CONFIRM=yes. Production also requires ALLOW_MAINTAIN=yes.`);
  process.exit(1);
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

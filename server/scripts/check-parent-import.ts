/**
 * Local checks for parent login import and first-login PIN change.
 * Refuses to run unless the database name contains "test".
 *
 *   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/sunsports_parent_import_test \
 *     npx tsx scripts/check-parent-import.ts
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma.js";
import { getDefaultPin, hashPin, parentNeedsPinChange, verifyPin } from "../src/lib/auth.js";
import { resetParentPinForStudent } from "../src/lib/ensureUser.js";
import {
  applyParentImport,
  parseParentImportText,
  previewParentImport,
} from "../src/lib/parentImport.js";
import { runParentImportChecks } from "../src/lib/parentImportCheck.js";

const CUSTOM_PIN = "135790";
const IMPORT_PIN = "246810";
const RESET_PIN = "147258";

function assert(name: string, ok: boolean, detail?: string) {
  if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  console.log(`PASS  ${name}`);
}

function dbName() {
  const raw = process.env.DATABASE_URL || "";
  try {
    return new URL(raw).pathname.replace(/^\//, "");
  } catch {
    return "";
  }
}

async function counts() {
  const [
    students,
    users,
    attendance,
    payments,
    packages,
    batches,
    coaches,
    enrollments,
    installments,
    logs,
    notes,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.user.count(),
    prisma.attendanceRecord.count(),
    prisma.feePayment.count(),
    prisma.feePackage.count(),
    prisma.batch.count(),
    prisma.coach.count(),
    prisma.feeEnrollment.count(),
    prisma.feeInstallment.count(),
    prisma.parentImportLog.count(),
    prisma.coachNote.count(),
  ]);
  return { students, users, attendance, payments, packages, batches, coaches, enrollments, installments, logs, notes };
}

function sameCounts(
  before: Awaited<ReturnType<typeof counts>>,
  after: Awaited<ReturnType<typeof counts>>,
  changes: Partial<Awaited<ReturnType<typeof counts>>> = {}
) {
  for (const key of Object.keys(before) as (keyof typeof before)[]) {
    const expected = key in changes ? changes[key]! : before[key];
    if (after[key] !== expected) {
      throw new Error(`${key} changed from ${before[key]} to ${after[key]}, expected ${expected}`);
    }
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run when NODE_ENV=production");
  }
  const name = dbName();
  if (!/test/i.test(name)) {
    throw new Error("Refusing to run. DATABASE_URL database name must include 'test'.");
  }

  const migration = readFileSync(
    new URL("../prisma/migrations/20251124180000_parent_import_log/migration.sql", import.meta.url),
    "utf8"
  );
  const migrationSql = migration
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert("migration sql is create-only", !/\b(UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i.test(migrationSql));
  assert("migration creates ParentImportLog", /CREATE TABLE "ParentImportLog"/i.test(migrationSql));

  runParentImportChecks();
  console.log("PASS  parent import unit checks");

  const customHash = await hashPin(CUSTOM_PIN);
  const defaultHash = await hashPin(getDefaultPin());
  const batch = await prisma.batch.create({ data: { name: "Check Batch", monthlyFee: 15000 } });
  const coach = await prisma.coach.create({ data: { name: "Check Coach", phone: "9001110101", isHeadCoach: false } });
  const pkg = await prisma.feePackage.create({
    data: { name: "Check Package", months: 1, monthlyAmount: 15000, totalAmount: 15000 },
  });

  const changedChild = await prisma.student.create({
    data: {
      name: "Changed Child",
      parentName: "Changed Parent",
      parentPhone: "9001110001",
      feeAmount: 15000,
      batchId: batch.id,
      medicalNotes: "keep-changed",
    },
  });
  const defaultChild = await prisma.student.create({
    data: { name: "Default Child", parentName: "Default Parent", parentPhone: "9001110002", feeAmount: 14000 },
  });
  const customChild = await prisma.student.create({
    data: { name: "Custom Child", parentName: "Custom Parent", parentPhone: "9001110003" },
  });
  const openChild = await prisma.student.create({
    data: {
      name: "Open Child",
      parentName: null,
      parentPhone: null,
      feeAmount: 15000,
      attendancePct: 77,
      medicalNotes: "keep",
      batchId: batch.id,
      batting: 4,
    },
  });
  const sibling = await prisma.student.create({ data: { name: "Sibling Child", parentPhone: null } });
  const secondSibling = await prisma.student.create({ data: { name: "Second Sibling", parentPhone: null } });
  const untouched = await prisma.student.create({
    data: { name: "Untouched Child", parentName: "Stay Parent", parentPhone: "9001110008", feeAmount: 2222, batchId: batch.id },
  });

  const changedAt = new Date("2026-01-15T00:00:00.000Z");
  const changedParent = await prisma.user.create({
    data: {
      phone: "9001110001",
      role: "parent",
      name: "Changed Parent",
      parentPhone: "9001110001",
      pinHash: customHash,
      mustChangePin: false,
      pinChangedAt: changedAt,
    },
  });
  const defaultParent = await prisma.user.create({
    data: {
      phone: "9001110002",
      role: "parent",
      name: "Default Parent",
      parentPhone: "9001110002",
      pinHash: defaultHash,
      mustChangePin: false,
      pinChangedAt: null,
    },
  });
  const customParent = await prisma.user.create({
    data: {
      phone: "9001110003",
      role: "parent",
      name: "Custom Parent",
      parentPhone: "9001110003",
      pinHash: customHash,
      mustChangePin: false,
      pinChangedAt: null,
    },
  });
  const coachUser = await prisma.user.create({
    data: { phone: "9001110101", role: "coach", name: "Check Coach", pinHash: defaultHash, mustChangePin: false, coachId: coach.id },
  });
  const forcedCoach = await prisma.user.create({
    data: { phone: "9001110102", role: "coach", name: "Forced Coach", pinHash: defaultHash, mustChangePin: true },
  });
  const admin = await prisma.user.create({
    data: { phone: "9001110199", role: "admin", name: "Check Admin", pinHash: defaultHash, mustChangePin: false },
  });

  await prisma.attendanceRecord.create({
    data: { studentId: openChild.id, batchId: batch.id, date: new Date("2026-11-01"), status: "present", note: "keep-attendance" },
  });
  const payment = await prisma.feePayment.create({
    data: { studentId: openChild.id, amount: 4321, method: "cash", month: "Nov 2026", note: "keep-payment" },
  });

  assert("changed parent is not forced", (await parentNeedsPinChange(changedParent)) === false);
  assert("default parent is forced", (await parentNeedsPinChange(defaultParent)) === true);
  assert("custom pin without pinChangedAt is not forced", (await parentNeedsPinChange(customParent)) === false);
  assert("coach on the shared PIN is not forced", (await parentNeedsPinChange(coachUser)) === false);
  assert("admin on the shared PIN is not forced", (await parentNeedsPinChange(admin)) === false);
  assert("coach PIN recovery still forces a change", (await parentNeedsPinChange(forcedCoach)) === true);

  const csv = [
    "student name,parent name,parent phone,pin",
    `Open Child,Imported Parent,9001115555,${IMPORT_PIN}`,
    "Untouched Child,Should Not Apply,9001110008,",
    "Nobody Here,Ghost,9001119999,",
  ].join("\n");
  const parsed = parseParentImportText(csv);
  if ("error" in parsed) throw new Error(parsed.error);

  const beforePreview = await counts();
  const preview = await previewParentImport(parsed.rows);
  sameCounts(beforePreview, await counts());
  assert("preview does not contain the PIN", !JSON.stringify(preview).includes(IMPORT_PIN));
  assert("preview marks the open child as a new parent", preview.rows[0]?.status === "create");
  assert("preview does not select a missing student", preview.rows[2]?.status === "problem");
  console.log("PASS  preview writes nothing");

  const actor = { id: admin.id, name: "Check Admin", role: "admin" };
  const applied = await applyParentImport(parsed.rows, [0], actor);
  assert("apply created one parent", applied.created === 1 && applied.linked === 1, JSON.stringify({ created: applied.created, linked: applied.linked }));
  assert("apply result hides the PIN", !JSON.stringify(applied).includes(IMPORT_PIN));
  const afterApply = await counts();
  sameCounts(beforePreview, afterApply, { users: beforePreview.users + 1, logs: beforePreview.logs + 1 });

  const openAfter = await prisma.student.findUniqueOrThrow({ where: { id: openChild.id } });
  assert("open child parent phone set", openAfter.parentPhone === "9001115555");
  assert("open child parent name set", openAfter.parentName === "Imported Parent");
  assert("open child fee untouched", openAfter.feeAmount === 15000 && openAfter.attendancePct === 77);
  assert("open child notes and batch untouched", openAfter.medicalNotes === "keep" && openAfter.batchId === batch.id && openAfter.batting === 4);

  const untouchedAfter = await prisma.student.findUniqueOrThrow({ where: { id: untouched.id } });
  assert("unticked student was not modified", untouchedAfter.parentPhone === "9001110008" && untouchedAfter.feeAmount === 2222);
  assert(
    "unticked student updatedAt unchanged",
    untouchedAfter.updatedAt.getTime() === untouched.updatedAt.getTime()
  );

  const payAfter = await prisma.feePayment.findUniqueOrThrow({ where: { id: payment.id } });
  assert("payment untouched", payAfter.amount === 4321 && payAfter.note === "keep-payment");
  const mark = await prisma.attendanceRecord.findFirstOrThrow({ where: { studentId: openChild.id } });
  assert("attendance untouched", mark.status === "present" && mark.note === "keep-attendance");
  const pkgAfter = await prisma.feePackage.findUniqueOrThrow({ where: { id: pkg.id } });
  assert("package untouched", pkgAfter.monthlyAmount === 15000 && pkgAfter.updatedAt.getTime() === pkg.updatedAt.getTime());
  const batchAfter = await prisma.batch.findUniqueOrThrow({ where: { id: batch.id } });
  assert("batch untouched", batchAfter.name === "Check Batch");

  const imported = await prisma.user.findUniqueOrThrow({ where: { phone_role: { phone: "9001115555", role: "parent" } } });
  assert("imported parent must change PIN", imported.mustChangePin === true && imported.pinChangedAt == null);
  assert("imported PIN matches the starting PIN", await verifyPin(IMPORT_PIN, imported.pinHash));
  assert("imported parent is forced", (await parentNeedsPinChange(imported)) === true);

  const log = await prisma.parentImportLog.findUniqueOrThrow({ where: { id: applied.logId || "" } });
  assert("audit stores the actor", log.actorUserId === admin.id && log.actorRole === "admin" && log.createdCount === 1);
  assert("audit does not store the PIN", !JSON.stringify(log.summary).includes(IMPORT_PIN));

  const problemBefore = await counts();
  const problem = await applyParentImport(parsed.rows, [2], actor);
  assert("problem row is skipped", problem.created === 0 && problem.skipped.length === 1 && problem.logId == null);
  sameCounts(problemBefore, await counts());
  console.log("PASS  apply skips problem rows without writing");

  const rename = await applyParentImport(
    [{ studentName: "Changed Child", parentName: "Renamed Parent", parentPhone: "9001110001", pin: "" }],
    [0],
    actor
  );
  assert("rename updates the parent", rename.updated === 1 && rename.created === 0);
  const changedAfter = await prisma.user.findUniqueOrThrow({ where: { id: changedParent.id } });
  assert("renamed parent kept their own PIN", await verifyPin(CUSTOM_PIN, changedAfter.pinHash));
  assert("renamed parent is still not forced", (await parentNeedsPinChange(changedAfter)) === false);
  assert("pinChangedAt was kept", changedAfter.pinChangedAt?.toISOString() === changedAt.toISOString());
  const changedStudent = await prisma.student.findUniqueOrThrow({ where: { id: changedChild.id } });
  assert("only the parent name changed", changedStudent.parentName === "Renamed Parent" && changedStudent.parentPhone === "9001110001");
  assert("changed child fee untouched", changedStudent.feeAmount === 15000 && changedStudent.medicalNotes === "keep-changed");

  const usersBeforeSiblings = await prisma.user.count();
  const siblingApply = await applyParentImport(
    [
      { studentName: "Sibling Child", parentName: "Sibling Parent", parentPhone: "9001116666", pin: "" },
      { studentName: "Second Sibling", parentName: "Sibling Parent", parentPhone: "9001116666", pin: "" },
    ],
    [0, 1],
    actor
  );
  assert("siblings create one parent", siblingApply.created === 1 && siblingApply.linked === 2);
  assert("sibling user count grew by one", (await prisma.user.count()) === usersBeforeSiblings + 1);
  const siblingRows = await prisma.student.findMany({
    where: { id: { in: [sibling.id, secondSibling.id] } },
    select: { parentPhone: true, parentName: true },
  });
  assert(
    "both siblings share the phone",
    siblingRows.every((row) => row.parentPhone === "9001116666" && row.parentName === "Sibling Parent")
  );

  const reset = await resetParentPinForStudent(defaultChild.id, RESET_PIN);
  assert("reset response hides the PIN", "body" in reset && !JSON.stringify(reset.body).includes(RESET_PIN));
  const defaultAfter = await prisma.user.findUniqueOrThrow({ where: { id: defaultParent.id } });
  assert("reset stores the new starting PIN", await verifyPin(RESET_PIN, defaultAfter.pinHash));
  assert("reset forces the next sign-in", defaultAfter.mustChangePin === true && defaultAfter.pinChangedAt == null);
  assert("reset parent is forced", (await parentNeedsPinChange(defaultAfter)) === true);
  const coachAfter = await prisma.user.findUniqueOrThrow({ where: { id: coachUser.id } });
  assert("coach PIN was not reset", coachAfter.pinHash === coachUser.pinHash && coachAfter.mustChangePin === false);

  console.log("PASS  database checks");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

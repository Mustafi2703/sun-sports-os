/**
 * Reverse one fee receipt by id. Does not delete the row.
 * Uses the same reversal as the head coach and admin API.
 *
 * From server/, after a backup, and only after migration 20251124120000_fee_payment_reversal
 * is applied:
 *
 *   PAYMENT_ID="the-payment-id" \
 *   REASON="Marked received by mistake" \
 *   REVERSE_CONFIRM=yes \
 *   npx tsx scripts/reverse-one-payment.ts
 *
 * When NODE_ENV=production, also set ALLOW_PAYMENT_REVERSAL=yes for this command only.
 * Do not put that variable on the Railway service.
 *
 * The script updates that payment, its installment, that enrollment when it was completed,
 * and that student's fee status. It does not update any other payment and it does not
 * write attendance.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { FeeActionError, reverseFeePayment } from "../src/lib/feeReversal.js";

const paymentId = String(process.env.PAYMENT_ID || "").trim();
const reason = String(process.env.REASON || "").trim();
const confirm = process.env.REVERSE_CONFIRM === "yes";

async function main() {
  if (!confirm) {
    console.error("Refusing to run. Take a backup, then set REVERSE_CONFIRM=yes.");
    process.exitCode = 1;
    return;
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PAYMENT_REVERSAL !== "yes") {
    console.error("Refusing to run in production. Set ALLOW_PAYMENT_REVERSAL=yes for this command only.");
    process.exitCode = 1;
    return;
  }
  if (!paymentId || reason.length < 3) {
    console.error("PAYMENT_ID and REASON (at least 3 characters) are required.");
    process.exitCode = 1;
    return;
  }

  const payment = await prisma.feePayment.findUnique({
    where: { id: paymentId },
    include: { student: { select: { id: true, name: true, feeStatus: true } } },
  });
  if (!payment) {
    console.error("No payment with that id. Nothing was changed.");
    process.exitCode = 1;
    return;
  }

  const attendanceBefore = await prisma.attendanceRecord.findMany({
    select: { id: true, studentId: true, status: true, date: true },
    orderBy: { id: "asc" },
  });

  console.log("About to reverse this payment only:");
  console.log(JSON.stringify({
    id: payment.id,
    studentId: payment.studentId,
    studentName: payment.student.name,
    amount: payment.amount,
    month: payment.month,
    method: payment.method,
    paidAt: payment.paidAt,
    note: payment.note,
    installmentId: payment.installmentId,
    reversedAt: payment.reversedAt,
    studentFeeStatus: payment.student.feeStatus,
  }, null, 2));

  if (payment.reversedAt) {
    console.error("Already reversed. Nothing was changed.");
    process.exitCode = 1;
    return;
  }

  try {
    const result = await reverseFeePayment(
      payment.id,
      {
        userId: null,
        name: String(process.env.REVERSED_BY_NAME || "manual script").trim() || "manual script",
        role: "script",
      },
      reason
    );
    const attendanceAfter = await prisma.attendanceRecord.findMany({
      select: { id: true, studentId: true, status: true, date: true },
      orderBy: { id: "asc" },
    });
    const sameAttendance = JSON.stringify(attendanceBefore) === JSON.stringify(attendanceAfter);
    console.log(JSON.stringify({
      ok: true,
      paymentId: result.payment.id,
      reversedAt: result.payment.reversedAt,
      reversalReason: result.payment.reversalReason,
      installmentReopened: result.installmentReopened,
      installment: result.installment,
      student: result.student,
      attendanceRows: attendanceAfter.length,
      attendanceUnchanged: sameAttendance,
    }, null, 2));
    if (!sameAttendance) {
      console.error("Attendance rows changed during this command. This script does not write attendance. Check whether someone marked attendance at the same time.");
      process.exitCode = 2;
    }
  } catch (e) {
    if (e instanceof FeeActionError) {
      console.error(e.message);
      process.exitCode = 1;
      return;
    }
    throw e;
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

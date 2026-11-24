import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { monthLabelFromDate, parseMonthLabel } from "./fees.js";
import { refreshStudentFeeState } from "./feeSync.js";

export class FeeActionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ReversalActor = {
  userId: string | null;
  name: string;
  role: string;
};

type PaymentRow = {
  id: string;
  studentId: string;
  amount: number;
  method: string;
  month: string | null;
  note: string | null;
  paidAt: Date;
  installmentId: string | null;
  reversedAt: Date | null;
  reversalReason: string | null;
  reversedByUserId: string | null;
  reversedByName: string | null;
  reversedByRole: string | null;
  voidedInstallmentId: string | null;
};

export function mapFeePayment(p: PaymentRow) {
  return {
    id: p.id,
    studentId: p.studentId,
    amount: p.amount,
    method: p.method,
    month: p.month,
    note: p.note,
    paidAt: p.paidAt.toISOString(),
    installmentId: p.installmentId,
    reversedAt: p.reversedAt ? p.reversedAt.toISOString() : null,
    reversalReason: p.reversalReason,
    reversedByUserId: p.reversedByUserId,
    reversedByName: p.reversedByName,
    reversedByRole: p.reversedByRole,
    voidedInstallmentId: p.voidedInstallmentId,
  };
}

function canonMonth(label: string) {
  return monthLabelFromDate(parseMonthLabel(label));
}

function cleanReason(raw: string) {
  const reason = raw.trim();
  if (!reason) throw new FeeActionError(400, "A reason is required");
  if (reason.length < 3) throw new FeeActionError(400, "Reason must be at least 3 characters");
  if (reason.length > 500) throw new FeeActionError(400, "Reason must be 500 characters or less");
  return reason;
}

/**
 * Keep the receipt and mark it reversed. The linked installment goes back to unpaid
 * and the student's dues are recalculated from open installments.
 * installmentId is cleared so a later receipt can be recorded for the same month.
 * The original installment id is stored on voidedInstallmentId.
 */
export async function reverseFeePayment(paymentId: string, actor: ReversalActor, reasonRaw: string) {
  const id = paymentId.trim();
  if (!id) throw new FeeActionError(400, "Payment id is required");
  const reason = cleanReason(reasonRaw);
  const actorName = actor.name.trim() || "Unknown";

  return prisma.$transaction(async (tx) => {
    const payment = await tx.feePayment.findUnique({ where: { id } });
    if (!payment) throw new FeeActionError(404, "Payment not found");
    if (payment.reversedAt) throw new FeeActionError(409, "This receipt is already reversed");

    const inst = await installmentToReopen(tx, payment);
    let installmentReopened = false;
    let syntheticPlanCancelled = false;
    if (inst && inst.status === "paid") {
      await tx.feeInstallment.update({
        where: { id: inst.id },
        data: { status: "pending", daysOverdue: 0, paidAt: null },
      });
      const enrollment = await tx.feeEnrollment.findUnique({
        where: { id: inst.enrollmentId },
        include: { installments: { select: { id: true } } },
      });
      // "Mark received" with no plan creates a one-month "Recorded receipt" wrapper.
      // Cancelling that wrapper puts package totals back. A real plan is reopened instead.
      const synthetic =
        enrollment?.packageName === "Recorded receipt" &&
        enrollment.months === 1 &&
        enrollment.installments.length === 1 &&
        enrollment.installments[0]?.id === inst.id;
      if (synthetic && enrollment) {
        await tx.feeEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "cancelled" },
        });
        syntheticPlanCancelled = true;
      } else if (enrollment?.status === "completed") {
        await tx.feeEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "active" },
        });
        installmentReopened = true;
      } else {
        installmentReopened = true;
      }
    }

    const claimed = await tx.feePayment.updateMany({
      where: { id: payment.id, reversedAt: null },
      data: {
        reversedAt: new Date(),
        reversalReason: reason,
        reversedByUserId: actor.userId,
        reversedByName: actorName,
        reversedByRole: actor.role,
        voidedInstallmentId: payment.installmentId,
        installmentId: null,
      },
    });
    if (claimed.count !== 1) throw new FeeActionError(409, "This receipt is already reversed");

    await refreshStudentFeeState(payment.studentId, tx);

    const [saved, student, installment] = await Promise.all([
      tx.feePayment.findUnique({ where: { id: payment.id } }),
      tx.student.findUnique({
        where: { id: payment.studentId },
        select: { id: true, name: true, feeStatus: true, feeAmount: true, daysOverdue: true },
      }),
      inst
        ? tx.feeInstallment.findUnique({
            where: { id: inst.id },
            select: { id: true, status: true, daysOverdue: true, paidAt: true, monthLabel: true },
          })
        : Promise.resolve(null),
    ]);
    if (!saved || !student) throw new FeeActionError(404, "Payment not found");

    return {
      ok: true as const,
      payment: mapFeePayment(saved),
      installmentReopened,
      syntheticPlanCancelled,
      installment: installment
        ? {
            id: installment.id,
            monthLabel: installment.monthLabel,
            status: installment.status,
            daysOverdue: installment.daysOverdue,
            paidAt: installment.paidAt ? installment.paidAt.toISOString() : null,
          }
        : null,
      student,
    };
  });
}

async function installmentToReopen(
  tx: Prisma.TransactionClient,
  payment: { id: string; studentId: string; month: string | null; installmentId: string | null }
) {
  if (payment.installmentId) {
    const linked = await tx.feeInstallment.findUnique({ where: { id: payment.installmentId } });
    if (!linked || linked.studentId !== payment.studentId) return null;
    return linked;
  }
  if (!payment.month) return null;
  const label = canonMonth(payment.month);
  const paid = await tx.feeInstallment.findMany({
    where: { studentId: payment.studentId, status: "paid" },
    include: { payment: true },
  });
  const matches = paid.filter((inst) => {
    if (canonMonth(inst.monthLabel) !== label) return false;
    if (inst.payment && !inst.payment.reversedAt && inst.payment.id !== payment.id) return false;
    return true;
  });
  if (matches.length !== 1) return null;
  return matches[0];
}

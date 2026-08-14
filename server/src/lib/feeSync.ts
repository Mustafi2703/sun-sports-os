import { prisma } from "./prisma.js";
import { daysBetween, studentFeeFieldsFromInstallment } from "./fees.js";

export {
  monthLabelFromDate,
  parseMonthLabel,
  addMonths,
  buildMonthSchedule,
  daysBetween,
  studentFeeFieldsFromInstallment,
} from "./fees.js";

/** Refresh overdue flags, then sync student.fee* from the next open installment. */
export async function refreshStudentFeeState(studentId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const open = await prisma.feeInstallment.findMany({
    where: { studentId, status: { in: ["pending", "overdue"] } },
    orderBy: { dueDate: "asc" },
  });

  for (const inst of open) {
    const days = daysBetween(inst.dueDate, today);
    const status = days > 0 ? "overdue" : "pending";
    if (inst.status !== status || inst.daysOverdue !== days) {
      await prisma.feeInstallment.update({
        where: { id: inst.id },
        data: { status, daysOverdue: days },
      });
    }
  }

  const next = await prisma.feeInstallment.findFirst({
    where: { studentId, status: { in: ["pending", "overdue"] } },
    orderBy: { dueDate: "asc" },
  });

  if (!next) {
    const last = await prisma.feeInstallment.findFirst({
      where: { studentId },
      orderBy: { dueDate: "desc" },
    });
    await prisma.student.update({
      where: { id: studentId },
      data: {
        feeStatus: "paid",
        daysOverdue: 0,
        ...(last ? { feeAmount: last.amount } : {}),
      },
    });
  } else {
    const fields = studentFeeFieldsFromInstallment({
      status: next.status === "overdue" || next.daysOverdue > 0 ? "overdue" : "pending",
      amount: next.amount,
      daysOverdue: next.daysOverdue,
    });
    await prisma.student.update({
      where: { id: studentId },
      data: fields,
    });
  }

  const enrollments = await prisma.feeEnrollment.findMany({
    where: { studentId, status: "active" },
    include: { installments: true },
  });
  for (const en of enrollments) {
    if (en.installments.length && en.installments.every((i) => i.status === "paid")) {
      await prisma.feeEnrollment.update({
        where: { id: en.id },
        data: { status: "completed" },
      });
    }
  }
}

export async function ensureDefaultFeePackages() {
  const count = await prisma.feePackage.count();
  if (count > 0) return;
  const defaults = [
    { name: "Monthly", description: "Pay month by month", months: 1, monthlyAmount: 15000 },
    { name: "Quarterly", description: "3-month package", months: 3, monthlyAmount: 15000 },
    { name: "Half year", description: "6-month package", months: 6, monthlyAmount: 14000 },
    { name: "Annual", description: "12-month package", months: 12, monthlyAmount: 13000 },
  ];
  for (const d of defaults) {
    await prisma.feePackage.create({
      data: {
        ...d,
        totalAmount: d.monthlyAmount * d.months,
        active: true,
      },
    });
  }
}

import { prisma } from "./prisma.js";
import {
  buildMonthSchedule,
  daysBetween,
  monthLabelFromDate,
  studentFeeFieldsFromInstallment,
} from "./fees.js";

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
  /** Distinct fee structures for 1 / 3 / 6 / 12 month packages */
  const defaults = [
    {
      name: "Monthly",
      description: "1-month fee structure — ₹15,000",
      months: 1,
      monthlyAmount: 15000,
    },
    {
      name: "Quarterly",
      description: "3-month fee structure — ₹14,000/mo (₹42,000 total)",
      months: 3,
      monthlyAmount: 14000,
    },
    {
      name: "Half year",
      description: "6-month fee structure — ₹13,000/mo (₹78,000 total)",
      months: 6,
      monthlyAmount: 13000,
    },
    {
      name: "Annual",
      description: "1-year fee structure — ₹12,000/mo (₹1,44,000 total)",
      months: 12,
      monthlyAmount: 12000,
    },
  ];

  for (const d of defaults) {
    const existing = await prisma.feePackage.findFirst({
      where: { months: d.months },
      orderBy: { createdAt: "asc" },
    });
    if (existing) {
      // Keep the canonical tier amounts in sync for the four standard durations
      await prisma.feePackage.update({
        where: { id: existing.id },
        data: {
          name: d.name,
          description: d.description,
          monthlyAmount: d.monthlyAmount,
          totalAmount: d.monthlyAmount * d.months,
          active: true,
        },
      });
      continue;
    }
    await prisma.feePackage.create({
      data: {
        ...d,
        totalAmount: d.monthlyAmount * d.months,
        active: true,
      },
    });
  }
}

/** Ensure Harry / Head Coach specialty has isHeadCoach privilege */
export async function ensureHeadCoachFlags() {
  await prisma.coach.updateMany({
    where: {
      OR: [
        { name: { contains: "Harry", mode: "insensitive" } },
        { specialty: { contains: "Head Coach", mode: "insensitive" } },
      ],
      isHeadCoach: false,
    },
    data: { isHeadCoach: true },
  });
}

export type FeePlanInput = {
  packageId?: string | null;
  packageName?: string | null;
  months?: number | null;
  monthlyAmount?: number | null;
  startMonth?: string | null;
};

export type EnrolledFeePlan = {
  id: string;
  studentId: string;
  packageId: string | null;
  packageName: string;
  months: number;
  monthlyAmount: number;
  totalAmount: number;
  startMonth: string;
  endMonth: string;
  status: string;
  installments: {
    id: string;
    enrollmentId: string;
    studentId: string;
    monthLabel: string;
    dueDate: Date;
    amount: number;
    status: string;
    daysOverdue: number;
    paidAt: Date | null;
  }[];
};

/**
 * Cancel prior active enrollments and create a new package schedule
 * (monthly installments from startMonth through package end).
 */
export async function enrollStudentOnFeePlan(
  studentId: string,
  input: FeePlanInput,
  fallbackMonthlyAmount = 15000
): Promise<EnrolledFeePlan> {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new Error("Student not found");

  let packageName = String(input.packageName || "").trim();
  let months = Math.max(1, Number(input.months) || 1);
  let monthlyAmount = Math.max(
    0,
    Number(input.monthlyAmount) || student.feeAmount || fallbackMonthlyAmount
  );
  let packageId: string | null = input.packageId ? String(input.packageId) : null;

  if (packageId) {
    const pkg = await prisma.feePackage.findUnique({ where: { id: packageId } });
    if (!pkg) throw new Error("Package not found");
    packageName = pkg.name;
    months = pkg.months;
    monthlyAmount = pkg.monthlyAmount;
  }
  if (!packageName) {
    packageName =
      months === 12 ? "1 year" : months === 1 ? "Monthly" : `${months}-month package`;
  }

  const startMonth = String(input.startMonth || monthLabelFromDate(new Date()));
  const schedule = buildMonthSchedule(startMonth, months);
  const endMonth = schedule[schedule.length - 1]?.monthLabel || startMonth;
  const totalAmount = monthlyAmount * months;

  await prisma.feeEnrollment.updateMany({
    where: { studentId, status: "active" },
    data: { status: "cancelled" },
  });

  // Drop unpaid installments from cancelled enrollments so dues board stays clean
  await prisma.feeInstallment.deleteMany({
    where: {
      studentId,
      status: { in: ["pending", "overdue"] },
      enrollment: { status: "cancelled" },
    },
  });

  const enrollment = await prisma.feeEnrollment.create({
    data: {
      studentId,
      packageId,
      packageName,
      months,
      monthlyAmount,
      totalAmount,
      startMonth,
      endMonth,
      status: "active",
      installments: {
        create: schedule.map((s) => ({
          studentId,
          monthLabel: s.monthLabel,
          dueDate: s.dueDate,
          amount: monthlyAmount,
          status: "pending",
          daysOverdue: 0,
        })),
      },
    },
    include: { installments: { orderBy: { dueDate: "asc" } } },
  });

  await prisma.student.update({
    where: { id: studentId },
    data: { feeAmount: monthlyAmount },
  });

  await refreshStudentFeeState(studentId);

  return enrollment;
}

/** True when request body asks to create/replace a fee plan */
export function shouldEnrollFeeFromBody(body: Record<string, unknown>): boolean {
  if (body.enrollFee === false || body.enrollFee === "false") return false;
  if (body.enrollFee === true || body.enrollFee === "true") return true;
  if (body.packageId) return true;
  if (body.feeMonths != null || body.months != null) return true;
  if (body.feePlan && typeof body.feePlan === "object") return true;
  return false;
}

export function feePlanInputFromBody(body: Record<string, unknown>): FeePlanInput {
  const nested =
    body.feePlan && typeof body.feePlan === "object"
      ? (body.feePlan as Record<string, unknown>)
      : {};
  return {
    packageId: (nested.packageId ?? body.packageId) as string | null | undefined,
    packageName: (nested.packageName ?? body.packageName) as string | null | undefined,
    months: Number(nested.months ?? body.feeMonths ?? body.months) || undefined,
    monthlyAmount: Number(nested.monthlyAmount ?? body.monthlyAmount ?? body.feeAmount) || undefined,
    startMonth: String(nested.startMonth ?? body.startMonth ?? "") || undefined,
  };
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function formatPhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return raw;
}

function ageFromDob(dob: string): number {
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return Math.max(5, age);
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
    throw new Error(
      "Refusing to seed while NODE_ENV=production. Seed is a manual local/dev/staging action and is not run on boot. Do not point it at the production database. A staging database that runs with NODE_ENV=production can opt in with ALLOW_SEED=true."
    );
  }

  const [studentCount, coachCount, batchCount, academyCount] = await Promise.all([
    prisma.student.count(),
    prisma.coach.count(),
    prisma.batch.count(),
    prisma.academy.count(),
  ]);

  if (studentCount > 0 || coachCount > 0 || batchCount > 0) {
    console.log(
      `Database already has roster data (students=${studentCount}, coaches=${coachCount}, batches=${batchCount}). Seed did not insert, update, or delete any rows.`
    );
    return;
  }

  console.log("Seeding Sun Sports HP demo data...");

  if (academyCount === 0) {
    await prisma.academy.create({
      data: {
        name: "Sun Sports",
        phone: "+91 90000 00000",
        address: "Demo Ground",
        program: "High Performance Cricket",
      },
    });
  } else {
    console.log("Academy row already exists. Left it unchanged.");
  }

  const coachData = [
    { name: "Demo Head Coach", phone: "9000000002", specialty: "Head Coach" },
    { name: "Demo Batting Coach", phone: "9000000003", specialty: "Batting Coach" },
    { name: "Demo Bowling Coach", phone: "9000000004", specialty: "Bowling Coach" },
    { name: "Demo Fielding Coach", phone: "9000000005", specialty: "Fielding Coach" },
    { name: "Demo Fitness Coach", phone: "9000000006", specialty: "Fitness Coach" },
    { name: "Demo Assistant Coach", phone: "9000000007", specialty: "Assistant Coach" },
  ];

  const coaches = [];
  for (const c of coachData) {
    coaches.push(
      await prisma.coach.create({
        data: {
          name: c.name,
          phone: formatPhone(c.phone),
          specialty: c.specialty,
          isHeadCoach: c.specialty === "Head Coach",
          initials: c.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
        },
      })
    );
  }

  const batch = await prisma.batch.create({
    data: {
      name: "High Performance",
      ageGroup: "Open (HP)",
      schedule: "Mon–Fri",
      time: "5:00 – 7:30 PM",
      venue: "Demo Ground",
      capacity: 20,
      monthlyFee: 15000,
      coachId: coaches[0].id,
    },
  });

  const students = Array.from({ length: 12 }, (_, index) => {
    const n = String(index + 1).padStart(2, "0");
    const month = String((index % 8) + 1).padStart(2, "0");
    return {
      name: `Demo Student ${n}`,
      dob: `201${index % 6}-${month}-15`,
      parentName: `Demo Parent ${n}`,
      parentPhone: `90000001${n}`,
      role: index % 2 === 0 ? "Batting" : "Bowling",
      joinDate: "2026-01-15",
      feeStatus: index % 4 === 0 ? "overdue1" : "paid",
      daysOverdue: index % 4 === 0 ? 3 : 0,
    };
  });

  for (const s of students) {
    await prisma.student.create({
      data: {
        name: s.name,
        dob: new Date(s.dob),
        age: ageFromDob(s.dob),
        parentName: s.parentName,
        parentPhone: formatPhone(s.parentPhone),
        role: s.role,
        joinDate: new Date(s.joinDate),
        medicalNotes: "None",
        feeStatus: s.feeStatus,
        daysOverdue: s.daysOverdue,
        feeAmount: 15000,
        attendancePct: 0,
        batting: 3,
        bowling: 3,
        fielding: 3,
        fitness: 3,
        temperament: 3,
        batchId: batch.id,
        bowlingSpeeds: undefined,
      },
    });
  }

  const { ensureDefaultFeePackages } = await import("../src/lib/feeSync.js");
  await ensureDefaultFeePackages();
  const { bootstrapPortalUsers } = await import("../src/lib/bootstrapUsers.js");
  await bootstrapPortalUsers();

  console.log(`Seeded: ${coaches.length} coaches, 1 batch, ${students.length} students (no mock attendance/payments)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

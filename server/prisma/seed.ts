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
        phone: "+91 90330 02641",
        address: "Ahmedabad, Gujarat",
        program: "High Performance Cricket",
      },
    });
  } else {
    console.log("Academy row already exists. Left it unchanged.");
  }

  const coachData = [
    { name: "Harry Sir", phone: "9033002641", specialty: "Head Coach" },
    { name: "Vikas Sir", phone: "8320901989", specialty: "Batting Coach" },
    { name: "Zala Sir", phone: "7573829550", specialty: "Bowling Coach" },
    { name: "Akhil Sir", phone: "8160746822", specialty: "Fielding Coach" },
    { name: "Siddhant Sir", phone: "9265752962", specialty: "Batting Coach" },
    { name: "Utsav Sir", phone: "7990591885", specialty: "Fielding Coach" },
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
      venue: "Sun Sports Ground",
      capacity: 20,
      monthlyFee: 15000,
      coachId: coaches[0].id,
    },
  });

  const students = [
    { name: "Ayaan Patel", dob: "2017-07-18", parentName: "Ronak Patel", parentPhone: "9712939753", role: "Batting", joinDate: "2026-05-19", feeStatus: "paid", daysOverdue: 0 },
    { name: "Hayaan Kanzaria", dob: "2016-01-24", parentName: "Ami Kanzaria", parentPhone: "8490063521", role: "All Rounder", joinDate: "2026-04-01", feeStatus: "paid", daysOverdue: 0 },
    { name: "Rishit Patel", dob: "2016-01-04", parentName: "Rajesh Verma", parentPhone: "917654321098", role: "Bowling All Rounder", joinDate: "2026-04-10", feeStatus: "overdue1", daysOverdue: 5 },
    { name: "Riyaan Patel", dob: "2016-01-04", parentName: "Bhavesh Patel", parentPhone: "927654321098", role: "Batting All Rounder", joinDate: "2026-04-10", feeStatus: "paid", daysOverdue: 0 },
    { name: "Samar Desai", dob: "2016-05-20", parentName: "Aditya Desai", parentPhone: "9998060606", role: "Batsmen", joinDate: "2026-06-01", feeStatus: "paid", daysOverdue: 0 },
    { name: "Rajveer Desai", dob: "2013-12-04", parentName: "Chetna Desai", parentPhone: "9687471747", role: "Batting All Rounder", joinDate: "2026-01-01", feeStatus: "overdue8", daysOverdue: 12 },
    { name: "Satyaraj Vaghela", dob: "2013-08-21", parentName: "Hardevsinh Vaghela", parentPhone: "9727389727", role: "WK Batsmen", joinDate: "2025-11-01", feeStatus: "paid", daysOverdue: 0 },
    { name: "Pratham Patel", dob: "2014-08-28", parentName: "Jatin Patel", parentPhone: "9824717103", role: "Batsmen", joinDate: "2025-11-01", feeStatus: "overdue1", daysOverdue: 3 },
    { name: "Vishal Yadav", dob: "2012-03-13", parentName: "Sunil Yadav", parentPhone: "9664859001", role: "Bowling", joinDate: "2026-06-01", feeStatus: "paid", daysOverdue: 0 },
    { name: "Jash Rana", dob: "2013-04-04", parentName: "Mahipalsinh Rana", parentPhone: "9099937890", role: "Bowling All Rounder", joinDate: "2026-05-01", feeStatus: "paid", daysOverdue: 0 },
    { name: "Shwet Patel", dob: "2011-09-15", parentName: "Jigar Patel", parentPhone: "9825123397", role: "WK Batsmen", joinDate: "2026-06-01", feeStatus: "paid", daysOverdue: 0 },
    { name: "Aditya Zala", dob: "2010-09-26", parentName: "Jitendrasinh Zala", parentPhone: "7573829550", role: "Bowling", joinDate: "2026-04-01", feeStatus: "overdue1", daysOverdue: 7 },
  ];

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

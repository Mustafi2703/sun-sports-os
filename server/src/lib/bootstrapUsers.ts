import { prisma } from "./prisma.js";
import { getDefaultPin, hashPin, normalizePhone } from "./auth.js";

/**
 * Ensures portal users exist for admin, every coach with a phone,
 * and every distinct parent phone on students. Idempotent.
 * Always refreshes PIN hash to DEFAULT_PIN so demo logins stay reliable.
 */
export async function bootstrapPortalUsers() {
  const pin = getDefaultPin();
  const pinHash = await hashPin(pin);

  // Normalize messy parent phones on students so login matching works
  const allStudents = await prisma.student.findMany({
    where: { parentPhone: { not: null } },
    select: { id: true, parentPhone: true },
  });
  for (const s of allStudents) {
    const normalized = normalizePhone(s.parentPhone);
    if (normalized && normalized.length >= 10 && normalized !== s.parentPhone) {
      await prisma.student.update({
        where: { id: s.id },
        data: { parentPhone: normalized },
      });
    }
  }

  const coaches = await prisma.coach.findMany();
  for (const c of coaches) {
    const phone = normalizePhone(c.phone);
    if (!phone || phone.length < 10) continue;
    if (c.phone !== phone) {
      await prisma.coach.update({ where: { id: c.id }, data: { phone } });
    }
  }

  const adminPhone = normalizePhone(process.env.ADMIN_PHONE || "9000000001");
  await prisma.user.upsert({
    where: { phone_role: { phone: adminPhone, role: "admin" } },
    create: {
      phone: adminPhone,
      pinHash,
      role: "admin",
      name: "Sun Sports Team",
    },
    update: { name: "Sun Sports Team", pinHash },
  });

  for (const c of await prisma.coach.findMany()) {
    const phone = normalizePhone(c.phone);
    if (!phone || phone.length < 10) continue;
    await prisma.user.upsert({
      where: { phone_role: { phone, role: "coach" } },
      create: {
        phone,
        pinHash,
        role: "coach",
        name: c.name,
        coachId: c.id,
      },
      update: {
        name: c.name,
        coachId: c.id,
        pinHash,
      },
    });
  }

  const students = await prisma.student.findMany({
    where: { parentPhone: { not: null } },
    select: { parentPhone: true, parentName: true },
  });

  const byPhone = new Map<string, string>();
  for (const s of students) {
    const phone = normalizePhone(s.parentPhone);
    if (!phone || phone.length < 10) continue;
    if (!byPhone.has(phone)) {
      byPhone.set(phone, s.parentName || "Parent");
    }
  }

  for (const [phone, name] of byPhone) {
    await prisma.user.upsert({
      where: { phone_role: { phone, role: "parent" } },
      create: {
        phone,
        pinHash,
        role: "parent",
        name,
        parentPhone: phone,
      },
      update: {
        name,
        parentPhone: phone,
        pinHash,
      },
    });
  }

  const counts = await prisma.user.groupBy({ by: ["role"], _count: true });
  console.log(
    "Portal users ready:",
    counts.map((c) => `${c.role}=${c._count}`).join(", "),
    `(default PIN ${pin})`
  );
}

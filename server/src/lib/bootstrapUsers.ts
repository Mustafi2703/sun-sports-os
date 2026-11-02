import { prisma } from "./prisma.js";
import { getDefaultPin, hashPin, normalizePhone } from "./auth.js";
import { normalizeEmail } from "./email.js";

/**
 * Ensures portal users exist for admin, every coach with a phone,
 * and every distinct parent phone on students. Idempotent.
 * Does NOT reset existing PIN hashes (preserves custom PINs).
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
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  await prisma.user.upsert({
    where: { phone_role: { phone: adminPhone, role: "admin" } },
    create: {
      phone: adminPhone,
      pinHash,
      role: "admin",
      name: "Sun Sports Team",
      ...(adminEmail ? { email: adminEmail } : {}),
    },
    update: {
      name: "Sun Sports Team",
      ...(adminEmail ? { email: adminEmail } : {}),
    },
  });

  for (const c of await prisma.coach.findMany()) {
    const phone = normalizePhone(c.phone);
    if (!phone || phone.length < 10) continue;
    const email = normalizeEmail(c.email);
    await prisma.user.upsert({
      where: { phone_role: { phone, role: "coach" } },
      create: {
        phone,
        pinHash,
        role: "coach",
        name: c.name,
        coachId: c.id,
        ...(email ? { email } : {}),
      },
      update: {
        name: c.name,
        coachId: c.id,
        ...(email ? { email } : {}),
      },
    });
  }

  const students = await prisma.student.findMany({
    where: { parentPhone: { not: null } },
    select: { parentPhone: true, parentName: true, parentEmail: true },
  });

  const byPhone = new Map<string, { name: string; email: string | null }>();
  for (const s of students) {
    const phone = normalizePhone(s.parentPhone);
    if (!phone || phone.length < 10) continue;
    const email = normalizeEmail(s.parentEmail);
    const existing = byPhone.get(phone);
    if (!existing) {
      byPhone.set(phone, { name: s.parentName || "Parent", email });
      continue;
    }
    if (!existing.email && email) existing.email = email;
  }

  for (const [phone, info] of byPhone) {
    const existing = await prisma.user.findUnique({
      where: { phone_role: { phone, role: "parent" } },
    });
    if (!existing) {
      await prisma.user.create({
        data: {
          phone,
          pinHash,
          role: "parent",
          name: info.name,
          parentPhone: phone,
          ...(info.email ? { email: info.email } : {}),
        },
      });
      continue;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: info.name,
        parentPhone: phone,
        ...(info.email ? { email: info.email } : {}),
      },
    });
  }

  // PINs are already issued. Sign-in opens the portal; PIN changes happen inside it.
  await prisma.user.updateMany({
    where: { mustChangePin: true },
    data: { mustChangePin: false },
  });

  const counts = await prisma.user.groupBy({ by: ["role"], _count: true });
  console.log(
    "Portal users ready:",
    counts.map((c) => `${c.role}=${c._count}`).join(", "),
    `(shared PIN ${pin}; change PIN is inside the portal)`
  );
}

import { prisma } from "./prisma.js";
import { getDefaultPin, hashPin, normalizePhone } from "./auth.js";
import { normalizeEmail } from "./email.js";

/** Create/update a single parent portal user for a phone (PIN set only on create). */
export async function ensureParentUser(
  parentPhone: string | null | undefined,
  parentName?: string | null,
  parentEmail?: string | null
) {
  const phone = normalizePhone(parentPhone);
  if (!phone || phone.length < 10) return null;
  const email = normalizeEmail(parentEmail);
  const existing = await prisma.user.findUnique({
    where: { phone_role: { phone, role: "parent" } },
  });
  if (!existing) {
    return prisma.user.create({
      data: {
        phone,
        pinHash: await hashPin(getDefaultPin()),
        role: "parent",
        name: parentName || "Parent",
        parentPhone: phone,
        ...(email ? { email } : {}),
      },
    });
  }
  return prisma.user.update({
    where: { id: existing.id },
    data: {
      name: parentName || existing.name || "Parent",
      parentPhone: phone,
      ...(parentEmail !== undefined ? { email } : {}),
    },
  });
}

/** True if any student is linked to this parent phone (normalized). */
export async function studentLinkedToParentPhone(phone10: string): Promise<boolean> {
  if (!phone10 || phone10.length < 10) return false;
  const rows = await prisma.student.findMany({
    where: { parentPhone: { not: null } },
    select: { parentPhone: true },
  });
  return rows.some((s) => normalizePhone(s.parentPhone) === phone10);
}

/** True if any coach row uses this phone (normalized). */
export async function coachLinkedToPhone(phone10: string): Promise<boolean> {
  if (!phone10 || phone10.length < 10) return false;
  const rows = await prisma.coach.findMany({
    where: { phone: { not: null } },
    select: { phone: true },
  });
  return rows.some((c) => normalizePhone(c.phone) === phone10);
}

/**
 * After student parent WhatsApp create/update/delete:
 * ensure new parent login exists; remove orphan parent login if old phone has no kids left.
 */
export async function syncParentAccess(opts: {
  oldPhone?: string | null;
  newPhone?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
}) {
  const neu = normalizePhone(opts.newPhone);
  const old = normalizePhone(opts.oldPhone);

  if (neu && neu.length >= 10) {
    await ensureParentUser(neu, opts.parentName, opts.parentEmail);
  }

  if (old && old.length >= 10 && old !== neu) {
    const stillLinked = await studentLinkedToParentPhone(old);
    if (!stillLinked) {
      await prisma.user.deleteMany({ where: { phone: old, role: "parent" } });
    }
  }
}

/** Create/update a single coach portal user (PIN set only on create) */
export async function ensureCoachUser(opts: {
  coachId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}) {
  const phone = normalizePhone(opts.phone);
  if (!phone || phone.length < 10) return null;
  const email = normalizeEmail(opts.email);
  const pinHash = await hashPin(getDefaultPin());
  return prisma.user.upsert({
    where: { phone_role: { phone, role: "coach" } },
    create: {
      phone,
      pinHash,
      role: "coach",
      name: opts.name,
      coachId: opts.coachId,
      ...(email ? { email } : {}),
    },
    update: {
      name: opts.name,
      coachId: opts.coachId,
      ...(opts.email !== undefined ? { email } : {}),
    },
  });
}

/** When coach phone changes, move portal login and drop orphan old login. */
export async function syncCoachAccess(opts: {
  coachId: string;
  name: string;
  oldPhone?: string | null;
  newPhone?: string | null;
  email?: string | null;
}) {
  const neu = normalizePhone(opts.newPhone);
  const old = normalizePhone(opts.oldPhone);

  if (neu && neu.length >= 10) {
    await ensureCoachUser({
      coachId: opts.coachId,
      name: opts.name,
      phone: neu,
      email: opts.email,
    });
  }

  if (old && old.length >= 10 && old !== neu) {
    const stillLinked = await coachLinkedToPhone(old);
    if (!stillLinked) {
      await prisma.user.deleteMany({ where: { phone: old, role: "coach" } });
    }
  }
}

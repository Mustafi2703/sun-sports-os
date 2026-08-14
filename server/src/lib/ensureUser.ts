import { prisma } from "./prisma.js";
import { getDefaultPin, hashPin, normalizePhone } from "./auth.js";

/** Create/update a single parent portal user for a phone (PIN set only on create) */
export async function ensureParentUser(parentPhone: string | null | undefined, parentName?: string | null) {
  const phone = normalizePhone(parentPhone);
  if (!phone || phone.length < 10) return null;
  const pinHash = await hashPin(getDefaultPin());
  return prisma.user.upsert({
    where: { phone_role: { phone, role: "parent" } },
    create: {
      phone,
      pinHash,
      role: "parent",
      name: parentName || "Parent",
      parentPhone: phone,
    },
    update: {
      name: parentName || "Parent",
      parentPhone: phone,
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
}) {
  const neu = normalizePhone(opts.newPhone);
  const old = normalizePhone(opts.oldPhone);

  if (neu && neu.length >= 10) {
    await ensureParentUser(neu, opts.parentName);
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
}) {
  const phone = normalizePhone(opts.phone);
  if (!phone || phone.length < 10) return null;
  const pinHash = await hashPin(getDefaultPin());
  return prisma.user.upsert({
    where: { phone_role: { phone, role: "coach" } },
    create: {
      phone,
      pinHash,
      role: "coach",
      name: opts.name,
      coachId: opts.coachId,
    },
    update: {
      name: opts.name,
      coachId: opts.coachId,
    },
  });
}

/** When coach phone changes, move portal login and drop orphan old login. */
export async function syncCoachAccess(opts: {
  coachId: string;
  name: string;
  oldPhone?: string | null;
  newPhone?: string | null;
}) {
  const neu = normalizePhone(opts.newPhone);
  const old = normalizePhone(opts.oldPhone);

  if (neu && neu.length >= 10) {
    await ensureCoachUser({ coachId: opts.coachId, name: opts.name, phone: neu });
  }

  if (old && old.length >= 10 && old !== neu) {
    const stillLinked = await coachLinkedToPhone(old);
    if (!stillLinked) {
      await prisma.user.deleteMany({ where: { phone: old, role: "coach" } });
    }
  }
}

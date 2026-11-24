import { prisma } from "./prisma.js";
import { getDefaultPin, hashPin, normalizePhone } from "./auth.js";
import { normalizeEmail } from "./email.js";

/** Blank means no PIN was supplied. A supplied value must be 4 to 6 digits. */
export function optionalInitialPin(raw: unknown): { pin?: string; error?: string } {
  if (raw == null) return {};
  const pin = String(raw).trim();
  if (!pin) return {};
  if (!/^\d{4,6}$/.test(pin)) return { error: "PIN must be 4 to 6 digits" };
  return { pin };
}

/**
 * Create or update one parent login.
 * initialPin, when set, is a starting PIN and forces a change on next sign-in.
 * Omit it to leave an existing PIN alone. A new login with no PIN uses the shared starting PIN
 * and must be changed on first sign-in.
 */
export async function ensureParentUser(
  parentPhone: string | null | undefined,
  parentName?: string | null,
  parentEmail?: string | null,
  initialPin?: string | null
) {
  const phone = normalizePhone(parentPhone);
  if (!phone || phone.length < 10) return null;
  const email = normalizeEmail(parentEmail);
  let pinToSet: string | null = null;
  if (initialPin != null && String(initialPin).trim()) {
    const pin = String(initialPin).trim();
    if (!/^\d{4,6}$/.test(pin)) {
      throw new Error("PIN must be 4 to 6 digits");
    }
    pinToSet = pin;
  }
  const existing = await prisma.user.findUnique({
    where: { phone_role: { phone, role: "parent" } },
  });
  if (!existing) {
    return prisma.user.create({
      data: {
        phone,
        pinHash: await hashPin(pinToSet || getDefaultPin()),
        role: "parent",
        name: parentName || "Parent",
        parentPhone: phone,
        mustChangePin: true,
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
      ...(pinToSet
        ? { pinHash: await hashPin(pinToSet), mustChangePin: true, pinChangedAt: null }
        : {}),
    },
  });
}

/** Admin or head coach sets one parent's starting PIN. The PIN is not returned. */
export async function resetParentPinForStudent(studentId: string, pin: string) {
  const cleaned = String(pin || "").replace(/\D/g, "");
  if (!/^\d{4,6}$/.test(cleaned)) {
    return { status: 400 as const, error: "PIN must be 4 to 6 digits" };
  }
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return { status: 404 as const, error: "Student not found" };
  const phone = normalizePhone(student.parentPhone);
  if (!phone || phone.length < 10) {
    return { status: 400 as const, error: "This student has no parent WhatsApp on file" };
  }
  const parent = await ensureParentUser(phone, student.parentName, student.parentEmail, cleaned);
  if (!parent) {
    return { status: 400 as const, error: "Could not find or create the parent portal login" };
  }
  return {
    status: 200 as const,
    body: {
      ok: true,
      parentPhone: phone,
      parentName: parent.name,
      mustChangePin: true,
      message: "Starting PIN saved. The parent must choose a new PIN after signing in.",
    },
  };
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
  initialPin?: string | null;
}) {
  const neu = normalizePhone(opts.newPhone);
  const old = normalizePhone(opts.oldPhone);

  if (neu && neu.length >= 10) {
    await ensureParentUser(neu, opts.parentName, opts.parentEmail, opts.initialPin);
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

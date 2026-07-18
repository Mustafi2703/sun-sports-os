import { prisma } from "./prisma.js";
import { getDefaultPin, hashPin, normalizePhone } from "./auth.js";

/** Create/update a single parent portal user for a phone */
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
      pinHash,
    },
  });
}

/** Create/update a single coach portal user */
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
      pinHash,
    },
  });
}

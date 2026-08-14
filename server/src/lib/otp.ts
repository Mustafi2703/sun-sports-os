import { prisma } from "./prisma.js";
import { hashPin, verifyPin } from "./auth.js";
import { sendOtpSms, shouldEchoOtp, smsConfigured, activeSmsProvider } from "./sms.js";

const OTP_TTL_MS = () => Number(process.env.OTP_TTL_SECONDS || 300) * 1000;
const MAX_ATTEMPTS = 5;

export function pinAuthAllowed(): boolean {
  return process.env.AUTH_ALLOW_PIN !== "false";
}

export function authMethods() {
  return {
    otp: true,
    pin: pinAuthAllowed(),
    smsConfigured: smsConfigured(),
    smsProvider: activeSmsProvider(),
  };
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createAndSendOtp(phone: string, portal: string) {
  const code = generateOtp();
  const codeHash = await hashPin(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS());

  // Invalidate prior challenges for this phone+portal
  await prisma.otpChallenge.deleteMany({ where: { phone, portal } });
  await prisma.otpChallenge.create({
    data: { phone, portal, codeHash, expiresAt },
  });

  const sms = await sendOtpSms(phone, code);
  const echo = shouldEchoOtp();
  if (echo) {
    console.log(`[otp] ${portal} ${phone} → ${code} (echo=${echo}, sms=${sms.delivered})`);
  }

  return {
    ok: true as const,
    expiresInSeconds: Math.floor(OTP_TTL_MS() / 1000),
    smsDelivered: sms.delivered,
    smsProvider: sms.provider,
    ...(echo ? { devOtp: code } : {}),
    ...(sms.error && !sms.delivered && !echo ? { warning: sms.error } : {}),
  };
}

export async function verifyOtpCode(phone: string, portal: string, code: string) {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone, portal },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { ok: false as const, error: "No OTP requested — tap Send OTP first" };
  if (challenge.expiresAt.getTime() < Date.now()) {
    await prisma.otpChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
    return { ok: false as const, error: "OTP expired — request a new one" };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    await prisma.otpChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
    return { ok: false as const, error: "Too many attempts — request a new OTP" };
  }

  const match = await verifyPin(code.trim(), challenge.codeHash);
  if (!match) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false as const, error: "Invalid OTP" };
  }

  await prisma.otpChallenge.deleteMany({ where: { phone, portal } });
  return { ok: true as const };
}

/** Best-effort cleanup of expired OTPs */
export async function purgeExpiredOtps() {
  await prisma.otpChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

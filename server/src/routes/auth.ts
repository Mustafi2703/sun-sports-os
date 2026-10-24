import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import {
  normalizePhone,
  portalToRole,
  requireAuth,
  hashPin,
  signToken,
  verifyPin,
  type AuthUser,
} from "../lib/auth.js";
import { authMethods, createAndSendOtp, pinAuthAllowed, purgeExpiredOtps, verifyOtpCode } from "../lib/otp.js";
import { coachLinkedToPhone, studentLinkedToParentPhone } from "../lib/ensureUser.js";
import { sendPinSms, shouldEchoOtp } from "../lib/sms.js";

export const authRouter = Router();

function toAuthUser(user: {
  id: string;
  phone: string;
  role: string;
  name: string;
  coachId: string | null;
  parentPhone: string | null;
  mustChangePin?: boolean;
}): AuthUser & { mustChangePin: boolean } {
  return {
    id: user.id,
    phone: user.phone,
    role: user.role as AuthUser["role"],
    name: user.name,
    coachId: user.coachId,
    parentPhone: user.parentPhone,
    mustChangePin: Boolean(user.mustChangePin),
  };
}

function loginResponse(user: ReturnType<typeof toAuthUser>) {
  return {
    token: signToken(user),
    user: {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
      coachId: user.coachId,
      parentPhone: user.parentPhone,
      mustChangePin: Boolean(user.mustChangePin),
    },
  };
}

function resetChallengePortal(portal: string) {
  return `${portal}:reset`;
}

function generateTempPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Only onboarded phones can authenticate:
 * - parent → must appear as Student.parentPhone (academy roster)
 * - coach  → must appear on a Coach.phone
 * - admin  → must have an admin User row
 * Random / unknown numbers never get OTP or PIN access.
 */
async function findPortalUser(phone: string, portal: AuthUser["role"]) {
  if (portal === "parent") {
    const linked = await studentLinkedToParentPhone(phone);
    if (!linked) {
      return {
        user: null,
        wrongPortal: null as string | null,
        notOnboarded:
          "This phone is not onboarded. Ask the academy to add your WhatsApp on the student profile.",
      };
    }
  }

  if (portal === "coach") {
    const linked = await coachLinkedToPhone(phone);
    if (!linked) {
      return {
        user: null,
        wrongPortal: null as string | null,
        notOnboarded:
          "This phone is not onboarded as a coach. Ask the academy to add your number in Settings → Coaches.",
      };
    }
  }

  const user = await prisma.user.findUnique({
    where: { phone_role: { phone, role: portal } },
  });
  if (user) {
    return { user, wrongPortal: null as string | null, notOnboarded: null as string | null };
  }

  const other = await prisma.user.findFirst({ where: { phone } });
  if (other) {
    const where = other.role === "admin" ? "/app/login" : `/${other.role}/login`;
    return {
      user: null,
      wrongPortal: `This phone is registered for the ${other.role} portal. Use ${where}`,
      notOnboarded: null as string | null,
    };
  }

  return {
    user: null,
    wrongPortal: null as string | null,
    notOnboarded:
      portal === "admin"
        ? "This phone is not onboarded for the team portal."
        : "This phone is not onboarded for this portal.",
  };
}

authRouter.get("/methods", (_req, res) => {
  res.json(authMethods());
});

/** Request a 6-digit OTP SMS for a registered portal phone */
authRouter.post("/request-otp", async (req, res) => {
  try {
    await purgeExpiredOtps().catch(() => undefined);
    const phone = normalizePhone(req.body.phone);
    const portal = portalToRole(String(req.body.portal || ""));

    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: "Valid 10-digit phone required" });
    }
    if (!portal) return res.status(400).json({ error: "portal must be parent, coach, or admin" });

    const { user, wrongPortal, notOnboarded } = await findPortalUser(phone, portal);
    if (wrongPortal) return res.status(403).json({ error: wrongPortal });
    if (notOnboarded || !user) {
      // Do not create or send OTP for unknown numbers
      return res.status(403).json({
        error: notOnboarded || "This phone is not onboarded for this portal.",
      });
    }

    const result = await createAndSendOtp(phone, portal);
    res.json({
      ...result,
      message: result.smsDelivered
        ? "OTP sent to your phone"
        : result.devOtp
          ? "OTP generated (SMS not configured — use the on-screen code)"
          : "OTP generated but SMS delivery failed — check SMS provider settings",
    });
  } catch (e) {
    console.error("request-otp error:", e);
    res.status(500).json({ error: "Could not send OTP — try again" });
  }
});

/** Verify OTP and issue JWT */
authRouter.post("/verify-otp", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || req.body.code || "").trim();
    const portal = portalToRole(String(req.body.portal || ""));

    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: "Valid 10-digit phone required" });
    }
    if (!portal) return res.status(400).json({ error: "portal must be parent, coach, or admin" });
    if (!/^\d{4,8}$/.test(otp)) return res.status(400).json({ error: "Enter the OTP from SMS" });

    const { user, wrongPortal, notOnboarded } = await findPortalUser(phone, portal);
    if (wrongPortal) return res.status(403).json({ error: wrongPortal });
    if (notOnboarded || !user) {
      return res.status(403).json({
        error: notOnboarded || "This phone is not onboarded for this portal.",
      });
    }

    const check = await verifyOtpCode(phone, portal, otp);
    if (!check.ok) return res.status(401).json({ error: check.error });

    res.json(loginResponse(toAuthUser(user)));
  } catch (e) {
    console.error("verify-otp error:", e);
    res.status(500).json({ error: "OTP verification failed — try again" });
  }
});

/** Legacy / backup PIN login (enabled unless AUTH_ALLOW_PIN=false) */
authRouter.post("/login", async (req, res) => {
  try {
    if (!pinAuthAllowed()) {
      return res.status(403).json({ error: "PIN login disabled — use OTP" });
    }

    const phone = normalizePhone(req.body.phone);
    const pin = String(req.body.pin || "").trim();
    const portal = portalToRole(String(req.body.portal || ""));

    if (!phone || phone.length < 10) return res.status(400).json({ error: "Valid 10-digit phone required" });
    if (!pin) return res.status(400).json({ error: "PIN required" });
    if (!portal) return res.status(400).json({ error: "portal must be parent, coach, or admin" });

    const { user, wrongPortal, notOnboarded } = await findPortalUser(phone, portal);
    if (wrongPortal) return res.status(403).json({ error: wrongPortal });
    if (notOnboarded || !user) {
      return res.status(403).json({
        error: notOnboarded || "This phone is not onboarded for this portal.",
      });
    }

    const ok = await verifyPin(pin, user.pinHash);
    if (!ok) return res.status(401).json({ error: "Invalid phone or PIN" });

    res.json(loginResponse(toAuthUser(user)));
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "Login failed — try again" });
  }
});

/**
 * Forgotten PIN — step 1. Text a one-time code to an onboarded parent, coach, or admin.
 * This is not a login method.
 */
authRouter.post("/forgot-pin/request", async (req, res) => {
  try {
    await purgeExpiredOtps().catch(() => undefined);
    const phone = normalizePhone(req.body.phone);
    const portal = portalToRole(String(req.body.portal || ""));
    if (!phone || phone.length < 10) return res.status(400).json({ error: "Valid 10-digit phone required" });
    if (!portal) return res.status(400).json({ error: "portal must be parent, coach, or admin" });

    const { user, wrongPortal, notOnboarded } = await findPortalUser(phone, portal);
    if (wrongPortal) return res.status(403).json({ error: wrongPortal });
    if (notOnboarded || !user) {
      return res.status(403).json({ error: notOnboarded || "This phone is not onboarded for this portal." });
    }

    const result = await createAndSendOtp(phone, resetChallengePortal(portal), "reset");
    if (!result.smsDelivered && !result.devOtp) {
      return res.status(503).json({
        error: "Could not send the reset code. Try again in a moment.",
      });
    }
    res.json({
      ok: true,
      expiresInSeconds: result.expiresInSeconds,
      smsDelivered: result.smsDelivered,
      message: result.smsDelivered
        ? "Reset code sent by SMS"
        : "Reset code generated (SMS not configured — use the on-screen code)",
      ...(result.devOtp ? { devOtp: result.devOtp } : {}),
    });
  } catch (e) {
    console.error("forgot-pin request error:", e);
    res.status(500).json({ error: "Could not send reset code — try again" });
  }
});

/**
 * Forgotten PIN — step 2. After the OTP checks out, issue a new PIN by SMS
 * and require a change on the next sign-in.
 */
authRouter.post("/forgot-pin/confirm", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || req.body.code || "").trim();
    const portal = portalToRole(String(req.body.portal || ""));
    if (!phone || phone.length < 10) return res.status(400).json({ error: "Valid 10-digit phone required" });
    if (!portal) return res.status(400).json({ error: "portal must be parent, coach, or admin" });
    if (!/^\d{4,8}$/.test(otp)) return res.status(400).json({ error: "Enter the code from SMS" });

    const { user, wrongPortal, notOnboarded } = await findPortalUser(phone, portal);
    if (wrongPortal) return res.status(403).json({ error: wrongPortal });
    if (notOnboarded || !user) {
      return res.status(403).json({ error: notOnboarded || "This phone is not onboarded for this portal." });
    }

    const check = await verifyOtpCode(phone, resetChallengePortal(portal), otp);
    if (!check.ok) return res.status(401).json({ error: check.error });

    const tempPin = generateTempPin();
    const echo = shouldEchoOtp();
    const sms = await sendPinSms(phone, tempPin);
    if (!sms.delivered && !echo) {
      return res.status(503).json({
        error: "Could not text the new PIN. Your current PIN is unchanged — try again shortly.",
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        pinHash: await hashPin(tempPin),
        mustChangePin: true,
        pinChangedAt: null,
      },
    });

    res.json({
      ok: true,
      pinSent: sms.delivered,
      message: sms.delivered
        ? "A new PIN was sent by SMS. Sign in with it, then choose your own PIN."
        : "SMS is not live yet. Sign in with the temporary PIN shown here, then choose your own.",
      ...(echo && !sms.delivered ? { devPin: tempPin } : {}),
    });
  } catch (e) {
    console.error("forgot-pin confirm error:", e);
    res.status(500).json({ error: "Could not reset PIN — try again" });
  }
});

/** Signed-in PIN change. First login and post-recovery skip the current PIN. */
authRouter.post("/change-pin", requireAuth(), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(401).json({ error: "User not found" });

    const newPin = String(req.body.newPin || "").replace(/\D/g, "");
    const currentPin = String(req.body.currentPin || "").trim();
    if (!/^\d{4,8}$/.test(newPin)) {
      return res.status(400).json({ error: "PIN must be 4 to 8 digits" });
    }

    if (!user.mustChangePin) {
      if (!currentPin) return res.status(400).json({ error: "Current PIN required" });
      const ok = await verifyPin(currentPin, user.pinHash);
      if (!ok) return res.status(401).json({ error: "Current PIN is incorrect" });
    }

    const same = await verifyPin(newPin, user.pinHash);
    if (same) return res.status(400).json({ error: "Choose a PIN that is different from the current one" });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { pinHash: await hashPin(newPin), mustChangePin: false, pinChangedAt: new Date() },
    });
    res.json({ ok: true, user: toAuthUser(updated) });
  } catch (e) {
    console.error("change-pin error:", e);
    res.status(500).json({ error: "Could not change PIN — try again" });
  }
});

authRouter.get("/me", requireAuth(), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(401).json({ error: "User not found" });
  res.json(toAuthUser(user));
});

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import {
  normalizePhone,
  portalToRole,
  requireAuth,
  signToken,
  verifyPin,
  type AuthUser,
} from "../lib/auth.js";
import { authMethods, createAndSendOtp, pinAuthAllowed, purgeExpiredOtps, verifyOtpCode } from "../lib/otp.js";

export const authRouter = Router();

function toAuthUser(user: {
  id: string;
  phone: string;
  role: string;
  name: string;
  coachId: string | null;
  parentPhone: string | null;
}): AuthUser {
  return {
    id: user.id,
    phone: user.phone,
    role: user.role as AuthUser["role"],
    name: user.name,
    coachId: user.coachId,
    parentPhone: user.parentPhone,
  };
}

function loginResponse(user: AuthUser) {
  return {
    token: signToken(user),
    user: {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
      coachId: user.coachId,
      parentPhone: user.parentPhone,
    },
  };
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
    const linked = await prisma.student.findFirst({
      where: { parentPhone: phone },
      select: { id: true },
    });
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
    const linked = await prisma.coach.findFirst({
      where: { phone },
      select: { id: true },
    });
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

authRouter.get("/me", requireAuth(), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(401).json({ error: "User not found" });
  res.json({
    id: user.id,
    phone: user.phone,
    role: user.role,
    name: user.name,
    coachId: user.coachId,
    parentPhone: user.parentPhone,
  });
});

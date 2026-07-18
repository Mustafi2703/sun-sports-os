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

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const pin = String(req.body.pin || "").trim();
    const portal = portalToRole(String(req.body.portal || ""));

    if (!phone || phone.length < 10) return res.status(400).json({ error: "Valid 10-digit phone required" });
    if (!pin) return res.status(400).json({ error: "PIN required" });
    if (!portal) return res.status(400).json({ error: "portal must be parent, coach, or admin" });

    const user = await prisma.user.findUnique({
      where: { phone_role: { phone, role: portal } },
    });
    if (!user) {
      const other = await prisma.user.findFirst({ where: { phone } });
      if (other) {
        const where =
          other.role === "admin" ? "/app/login" : `/${other.role}/login`;
        return res.status(403).json({
          error: `This phone is registered for the ${other.role} portal. Use ${where}`,
        });
      }
      return res.status(401).json({ error: "Invalid phone or PIN" });
    }

    const ok = await verifyPin(pin, user.pinHash);
    if (!ok) return res.status(401).json({ error: "Invalid phone or PIN" });

    const authUser: AuthUser = {
      id: user.id,
      phone: user.phone,
      role: user.role as AuthUser["role"],
      name: user.name,
      coachId: user.coachId,
      parentPhone: user.parentPhone,
    };

    res.json({
      token: signToken(authUser),
      user: {
        id: authUser.id,
        phone: authUser.phone,
        role: authUser.role,
        name: authUser.name,
        coachId: authUser.coachId,
        parentPhone: authUser.parentPhone,
      },
    });
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

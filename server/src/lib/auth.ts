import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export type UserRole = "parent" | "coach" | "admin";
export type Portal = "parent" | "coach" | "admin";

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  name: string;
  coachId?: string | null;
  parentPhone?: string | null;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
  phone: string;
  name: string;
  coachId?: string | null;
  parentPhone?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = () => process.env.JWT_SECRET || "sun-sports-dev-secret-change-me";
const DEFAULT_PIN = () => process.env.DEFAULT_PIN || "1234";

/** Normalize any phone-ish string to last 10 digits for unique matching. */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export function signToken(user: AuthUser): string {
  const payload: JwtPayload = {
    sub: user.id,
    role: user.role,
    phone: user.phone,
    name: user.name,
    coachId: user.coachId,
    parentPhone: user.parentPhone,
  };
  return jwt.sign(payload, JWT_SECRET(), { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET()) as JwtPayload;
}

export function getDefaultPin(): string {
  return DEFAULT_PIN();
}

export function extractBearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

export function requireAuth(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractBearer(req);
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const payload = verifyToken(token);
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ error: "Forbidden for this role" });
      }
      req.user = {
        id: payload.sub,
        phone: payload.phone,
        role: payload.role,
        name: payload.name,
        coachId: payload.coachId,
        parentPhone: payload.parentPhone,
      };
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

export function portalToRole(portal: string): UserRole | null {
  if (portal === "parent" || portal === "coach" || portal === "admin") return portal;
  return null;
}

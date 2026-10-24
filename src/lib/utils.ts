import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Blank uses the fallback. 0 is a real amount. */
export function parseRupees(raw: unknown, fallback: number): number {
  if (raw == null) return fallback;
  if (typeof raw === "string" && raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

/**
 * Email via Resend for Forgot PIN.
 *
 * Railway:
 *   RESEND_API_KEY
 *   RESEND_FROM   e.g. "Sun Sports <noreply@yourdomain.com>"
 *   ADMIN_EMAIL   optional — sets the team admin User.email on bootstrap
 *
 * Codes are never returned to the app in production unless OTP_DEV_ECHO=true.
 */

export type EmailResult = { delivered: boolean; provider: string; error?: string };

export function normalizeEmail(raw: string | null | undefined): string | null {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export function emailStatusLine(): string {
  if (!emailConfigured()) {
    return "[email] not configured — set RESEND_API_KEY and RESEND_FROM on Railway for Forgot PIN";
  }
  return `[email] resend ready (from ${process.env.RESEND_FROM})`;
}

export function shouldEchoEmailCodes(): boolean {
  if (process.env.OTP_DEV_ECHO === "true") return true;
  if (process.env.OTP_DEV_ECHO === "false") return false;
  if (process.env.NODE_ENV === "production") return false;
  return !emailConfigured();
}

async function sendResend(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return { delivered: false, provider: "none", error: "Resend is not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      const detail = text.slice(0, 200);
      console.error("[email] Resend error:", res.status, detail);
      return { delivered: false, provider: "resend", error: detail };
    }
    return { delivered: true, provider: "resend" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email] Resend failed:", msg);
    return { delivered: false, provider: "resend", error: msg };
  }
}

export async function sendResetCodeEmail(to: string, code: string): Promise<EmailResult> {
  const subject = "Sun Sports PIN reset code";
  const text = `Your Sun Sports PIN reset code is ${code}. It is valid for 5 minutes. Do not share this code.`;
  const html = `<p>Your Sun Sports PIN reset code is <strong>${code}</strong>.</p><p>It is valid for 5 minutes. Do not share this code.</p>`;
  return sendResend({ to, subject, text, html });
}

export async function sendTempPinEmail(to: string, pin: string): Promise<EmailResult> {
  const subject = "Sun Sports temporary PIN";
  const text = `Your temporary Sun Sports PIN is ${pin}. Sign in with it, then choose your own PIN. Do not share this PIN.`;
  const html = `<p>Your temporary Sun Sports PIN is <strong>${pin}</strong>.</p><p>Sign in with it, then choose your own PIN. Do not share this PIN.</p>`;
  return sendResend({ to, subject, text, html });
}

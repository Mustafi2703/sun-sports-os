/**
 * Email via Resend for Forgot PIN.
 *
 * Railway:
 *   RESEND_API_KEY
 *   RESEND_FROM   e.g. "Sun Sports <noreply@yourdomain.com>"
 *   ADMIN_EMAIL   optional. Sets the team admin User.email on bootstrap.
 *
 * The PIN is never returned to the app in production unless OTP_DEV_ECHO=true.
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

/** Mask for UI: s***@gmail.com */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const keep = local.slice(0, Math.min(1, local.length));
  return `${keep}***@${domain}`;
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

/** Replace the stored PIN only after the email went out, or in local echo mode. */
export function shouldApplyTempPin(emailDelivered: boolean, echo: boolean): boolean {
  return emailDelivered || echo;
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

export async function sendTempPinEmail(to: string, pin: string): Promise<EmailResult> {
  const subject = "Your Sun Sports sign-in PIN";
  const text = [
    "Sun Sports High Performance",
    "",
    "Someone asked for a new sign-in PIN for this account.",
    `Your temporary PIN is ${pin}.`,
    "",
    "Sign in with your mobile number and this PIN. After you sign in, choose a PIN only you know.",
    "This PIN replaces your previous one.",
    "",
    "If you did not ask for this, contact the academy. Do not share this PIN.",
  ].join("\n");
  const html = [
    "<p>Sun Sports High Performance</p>",
    "<p>Someone asked for a new sign-in PIN for this account.</p>",
    `<p>Your temporary PIN is <strong>${pin}</strong>.</p>`,
    "<p>Sign in with your mobile number and this PIN. After you sign in, choose a PIN only you know.</p>",
    "<p>This PIN replaces your previous one.</p>",
    "<p>If you did not ask for this, contact the academy. Do not share this PIN.</p>",
  ].join("");
  return sendResend({ to, subject, text, html });
}

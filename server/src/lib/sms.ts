/**
 * SMS for PIN reset.
 *
 * Production (Railway) — MSG91, two DLT templates, both with ##OTP##:
 *   SMS_PROVIDER=msg91
 *   MSG91_AUTH_KEY
 *   MSG91_TEMPLATE_ID       6-digit reset code
 *   MSG91_PIN_TEMPLATE_ID   6-digit temporary PIN
 *   OTP_DEV_ECHO=false
 *
 * Twilio also works:
 *   SMS_PROVIDER=twilio
 *   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM
 *
 * Codes are never returned to the app in production unless OTP_DEV_ECHO=true.
 */

export type SmsResult = { delivered: boolean; provider: string; error?: string };

export function smsConfigured(): boolean {
  return activeSmsProvider() !== "none";
}

export function activeSmsProvider(): "msg91" | "twilio" | "none" {
  const provider = (process.env.SMS_PROVIDER || "").toLowerCase();
  if (provider === "msg91" || process.env.MSG91_AUTH_KEY) {
    return process.env.MSG91_AUTH_KEY ? "msg91" : "none";
  }
  if (provider === "twilio" || process.env.TWILIO_ACCOUNT_SID) {
    return process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM
      ? "twilio"
      : "none";
  }
  return "none";
}

/** Safe to print on startup. Does not include keys. */
export function smsStatusLine(): string {
  const provider = activeSmsProvider();
  if (provider === "none") {
    return "[sms] not configured — PIN reset texts will not send until MSG91 is set on Railway";
  }
  if (provider === "twilio") return "[sms] twilio ready";
  const reset = process.env.MSG91_TEMPLATE_ID ? "set" : "MISSING";
  const pin = process.env.MSG91_PIN_TEMPLATE_ID ? "set" : "MISSING";
  return `[sms] msg91 (reset template ${reset}, new-PIN template ${pin})`;
}

export function shouldEchoOtp(): boolean {
  if (process.env.OTP_DEV_ECHO === "true") return true;
  if (process.env.OTP_DEV_ECHO === "false") return false;
  if (process.env.NODE_ENV === "production") return false;
  return !smsConfigured();
}

export async function sendOtpSms(
  phone10: string,
  otp: string,
  purpose: "login" | "reset" = "login"
): Promise<SmsResult> {
  const provider = activeSmsProvider();
  const message =
    purpose === "reset"
      ? `Sun Sports PIN reset code: ${otp}. Valid for 5 minutes. Do not share.`
      : `Sun Sports SportsOS login code: ${otp}. Valid for 5 minutes. Do not share.`;

  if (provider === "msg91") {
    return sendMsg91Otp(phone10, otp, process.env.MSG91_TEMPLATE_ID, "MSG91_TEMPLATE_ID");
  }
  if (provider === "twilio") return sendTwilio(phone10, message);
  console.warn(`[sms] No SMS provider configured — OTP for ${phone10} not delivered via SMS`);
  return { delivered: false, provider: "none", error: "SMS provider not configured" };
}

/** Text the temporary PIN after a successful OTP recovery. */
export async function sendPinSms(phone10: string, pin: string): Promise<SmsResult> {
  const provider = activeSmsProvider();
  const message = `Sun Sports: your new PIN is ${pin}. Sign in and change it. Do not share this PIN.`;
  if (provider === "msg91") {
    return sendMsg91Otp(phone10, pin, process.env.MSG91_PIN_TEMPLATE_ID, "MSG91_PIN_TEMPLATE_ID");
  }
  if (provider === "twilio") return sendTwilio(phone10, message);
  console.warn(`[sms] No SMS provider configured — new PIN for ${phone10} not delivered`);
  return { delivered: false, provider: "none", error: "SMS provider not configured" };
}

async function sendMsg91Otp(
  phone10: string,
  code: string,
  templateId: string | undefined,
  missingEnv: string
): Promise<SmsResult> {
  if (!templateId) {
    const error = `${missingEnv} is not set`;
    console.error(`[sms] MSG91 ${error}`);
    return { delivered: false, provider: "msg91", error };
  }

  const authkey = process.env.MSG91_AUTH_KEY!;
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", `91${phone10}`);
  url.searchParams.set("otp", code);
  url.searchParams.set("otp_length", String(code.length));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authkey, "Content-Type": "application/json" },
    });
    const text = await res.text();
    let parsed: { type?: string; message?: string } | null = null;
    try {
      parsed = JSON.parse(text) as { type?: string; message?: string };
    } catch {
      parsed = null;
    }
    if (!res.ok || parsed?.type === "error") {
      const detail = (parsed?.message || text || `HTTP ${res.status}`).slice(0, 200);
      console.error("[sms] MSG91 OTP error:", res.status, detail);
      return { delivered: false, provider: "msg91", error: detail };
    }
    return { delivered: true, provider: "msg91" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sms] MSG91 failed:", msg);
    return { delivered: false, provider: "msg91", error: msg };
  }
}

async function sendTwilio(phone10: string, message: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM!;
  const to = `+91${phone10}`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  try {
    const body = new URLSearchParams({ To: to, From: from, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[sms] Twilio error:", res.status, text);
      return { delivered: false, provider: "twilio", error: text.slice(0, 200) };
    }
    return { delivered: true, provider: "twilio" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sms] Twilio failed:", msg);
    return { delivered: false, provider: "twilio", error: msg };
  }
}

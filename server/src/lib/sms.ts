/**
 * SMS delivery for OTPs.
 * Configure one of:
 *   SMS_PROVIDER=msg91  + MSG91_AUTH_KEY (+ optional MSG91_TEMPLATE_ID, MSG91_SENDER)
 *   SMS_PROVIDER=twilio  + TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM
 * If neither is configured, sendSms returns { delivered: false } and the OTP
 * layer may echo the code when OTP_DEV_ECHO=true (default outside production).
 */

export type SmsResult = { delivered: boolean; provider: string; error?: string };

export function smsConfigured(): boolean {
  const provider = (process.env.SMS_PROVIDER || "").toLowerCase();
  if (provider === "msg91" || process.env.MSG91_AUTH_KEY) {
    return Boolean(process.env.MSG91_AUTH_KEY);
  }
  if (provider === "twilio" || process.env.TWILIO_ACCOUNT_SID) {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM
    );
  }
  return false;
}

export function activeSmsProvider(): "msg91" | "twilio" | "none" {
  if (process.env.MSG91_AUTH_KEY || process.env.SMS_PROVIDER === "msg91") {
    return process.env.MSG91_AUTH_KEY ? "msg91" : "none";
  }
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  ) {
    return "twilio";
  }
  return "none";
}

export async function sendOtpSms(phone10: string, otp: string): Promise<SmsResult> {
  const provider = activeSmsProvider();
  const message = `Sun Sports SportsOS login code: ${otp}. Valid for 5 minutes. Do not share.`;

  if (provider === "msg91") {
    return sendMsg91(phone10, otp, message);
  }
  if (provider === "twilio") {
    return sendTwilio(phone10, message);
  }
  console.warn(`[sms] No SMS provider configured — OTP for ${phone10} not delivered via SMS`);
  return { delivered: false, provider: "none", error: "SMS provider not configured" };
}

async function sendMsg91(phone10: string, otp: string, message: string): Promise<SmsResult> {
  const authkey = process.env.MSG91_AUTH_KEY!;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const sender = process.env.MSG91_SENDER || "SUNSPT";
  const mobile = `91${phone10}`;

  try {
    if (templateId) {
      const url = new URL("https://control.msg91.com/api/v5/otp");
      url.searchParams.set("template_id", templateId);
      url.searchParams.set("mobile", mobile);
      url.searchParams.set("otp", otp);
      url.searchParams.set("otp_length", String(otp.length));
      const res = await fetch(url, {
        method: "POST",
        headers: { authkey, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[sms] MSG91 OTP error:", res.status, text);
        return { delivered: false, provider: "msg91", error: text.slice(0, 200) };
      }
      return { delivered: true, provider: "msg91" };
    }

    // Fallback: transactional SMS API
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        authkey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        template_id: process.env.MSG91_FLOW_TEMPLATE_ID,
        short_url: "0",
        recipients: [{ mobiles: mobile, OTP: otp, VAR1: otp }],
      }),
    });

    // If flow template missing, try classic sendhttp
    if (!process.env.MSG91_FLOW_TEMPLATE_ID || !res.ok) {
      const classic = new URL("https://api.msg91.com/api/sendhttp.php");
      classic.searchParams.set("authkey", authkey);
      classic.searchParams.set("mobiles", mobile);
      classic.searchParams.set("message", message);
      classic.searchParams.set("sender", sender);
      classic.searchParams.set("route", "4");
      classic.searchParams.set("country", "91");
      const cRes = await fetch(classic);
      const body = await cRes.text();
      if (!cRes.ok) {
        console.error("[sms] MSG91 sendhttp error:", body);
        return { delivered: false, provider: "msg91", error: body.slice(0, 200) };
      }
      return { delivered: true, provider: "msg91" };
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

export function shouldEchoOtp(): boolean {
  if (process.env.OTP_DEV_ECHO === "true") return true;
  if (process.env.OTP_DEV_ECHO === "false") return false;
  // Default: echo when SMS is not configured (small-academy / staging)
  return !smsConfigured();
}

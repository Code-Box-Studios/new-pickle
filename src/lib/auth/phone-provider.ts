import { AppError } from "@/lib/booking/errors";

function credentials() {
  const account = process.env.TWILIO_ACCOUNT_SID;
  const secret = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (account && secret && service && /^VA[0-9a-f]{32}$/i.test(service)) {
    return { account, secret, service };
  }
  return null;
}

export function phoneProvider(): "twilio" | "development" {
  if (credentials()) return "twilio";
  if (process.env.NODE_ENV !== "production" && !process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_AUTH_TOKEN && !process.env.TWILIO_VERIFY_SERVICE_SID) return "development";
  throw new AppError("Phone sign-in is temporarily unavailable. Please use email.", 503, "phone_unavailable");
}

async function verifyRequest(endpoint: string, body: URLSearchParams) {
  const config = credentials();
  if (!config) throw new AppError("Phone sign-in is temporarily unavailable. Please use email.", 503, "phone_unavailable");
  try {
    return await fetch(`https://verify.twilio.com/v2/Services/${config.service}/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.account}:${config.secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch {
    throw new AppError("We couldn't reach the SMS service. Please try again.", 503, "sms_unavailable");
  }
}

export async function startSmsVerification(phone: string): Promise<string> {
  const response = await verifyRequest("Verifications", new URLSearchParams({ To: phone, Channel: "sms", Locale: "en" }));
  if (response.status === 429) throw new AppError("Too many codes requested. Please try again later.", 429, "rate_limited");
  if (!response.ok) throw new AppError("We couldn't send the code. Check your number or use email.", 503, "sms_unavailable");
  const data = await response.json() as { sid?: string; status?: string };
  if (!data.sid || !/^VE[0-9a-f]{32}$/i.test(data.sid) || data.status !== "pending") throw new AppError("We couldn't send the code. Please use email.", 503, "sms_unavailable");
  return data.sid;
}

export async function checkSmsVerification(sid: string, code: string): Promise<boolean> {
  const response = await verifyRequest("VerificationCheck", new URLSearchParams({ VerificationSid: sid, Code: code }));
  if (response.status === 404 || response.status === 400) return false;
  if (response.status === 429) throw new AppError("Too many attempts. Please request a new code later.", 429, "rate_limited");
  if (!response.ok) throw new AppError("We couldn't verify the code. Please try again.", 503, "sms_unavailable");
  const data = await response.json() as { status?: string };
  return data.status === "approved";
}

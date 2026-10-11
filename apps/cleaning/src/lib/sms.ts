import { createHmac } from "node:crypto"

// Minimal Twilio SMS over the REST API (no SDK dependency), mirroring email.ts.
//
// "Configured" requires an Account SID + Auth Token AND a sender (a From number
// or a Messaging Service SID). Unconfigured = a dev log + delivered:false, so
// nothing user-facing ever renders a dead "text" button — callers degrade.
//
// Required env:
//   TWILIO_ACCOUNT_SID        (ACxxxx…)
//   TWILIO_AUTH_TOKEN         (used for sending AND inbound signature checks)
//   TWILIO_FROM_NUMBER        E.164, e.g. +15125550123   (or set the one below)
//   TWILIO_MESSAGING_SERVICE_SID  (MGxxxx…; alternative sender to a From number)

export type SmsResult = { delivered: boolean; dev?: boolean; providerId?: string; error?: string }

export function isSmsConfigured(): boolean {
  return (
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    (!!process.env.TWILIO_FROM_NUMBER || !!process.env.TWILIO_MESSAGING_SERVICE_SID)
  )
}

export async function sendSms(opts: { to: string; body: string }): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  const msgService = process.env.TWILIO_MESSAGING_SERVICE_SID
  if (!opts.to) return { delivered: false, error: "No recipient" }

  if (!sid || !token || (!from && !msgService)) {
    console.log(`[sms:dev] to=${opts.to}\n${opts.body}`)
    return { delivered: false, dev: true }
  }
  const form = new URLSearchParams({ To: opts.to, Body: opts.body })
  if (msgService) form.set("MessagingServiceSid", msgService)
  else form.set("From", from!)
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    })
    const data = (await res.json().catch(() => null)) as { sid?: string; message?: string } | null
    if (res.ok) return { delivered: true, providerId: data?.sid }
    return { delivered: false, error: data?.message ? `SMS provider rejected: ${data.message.slice(0, 160)}` : `SMS provider error ${res.status}` }
  } catch {
    return { delivered: false, error: "Could not reach the SMS provider" }
  }
}

/**
 * Verify an inbound Twilio webhook signature (X-Twilio-Signature). The expected
 * value is base64(HMAC-SHA1(authToken, fullUrl + sorted(key+value) for each
 * POST param)). Returns false when no auth token is configured (reject by
 * default on a public endpoint).
 */
export function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!token || !signature) return false
  const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], url)
  const expected = createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64")
  // Constant-time-ish compare.
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

/** STOP/START keyword handling for inbound SMS (opt-out compliance). */
export function smsKeyword(body: string): "stop" | "start" | null {
  const b = body.trim().toUpperCase()
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(b)) return "stop"
  if (["START", "YES", "UNSTOP"].includes(b)) return "start"
  return null
}

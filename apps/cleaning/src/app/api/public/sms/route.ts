import { isSmsConfigured, verifyTwilioSignature, smsKeyword } from "@/lib/sms"
import { intakeSmsIssue } from "@/lib/data/sms-intake"

// PUBLIC inbound Twilio webhook (Phase 35). Only live once Twilio is configured.
// Verifies the Twilio signature (reject by default), honors STOP/START, dedupes
// retries by MessageSid (in the data layer), files the text as an issue, and
// replies with a reference via TwiML. An unknown sender is flagged, never
// rejected.
const twiml = (msg?: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg.replace(/[<>&]/g, "")}</Message>` : ""}</Response>`,
    { status: 200, headers: { "content-type": "text/xml" } })

export async function POST(request: Request) {
  // Not live until Twilio is configured — nothing to verify against, so no-op.
  if (!isSmsConfigured()) return twiml()

  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) params[k] = typeof v === "string" ? v : ""

  const url = process.env.CLEANING_APP_URL ? `${process.env.CLEANING_APP_URL}/api/public/sms` : request.url
  if (!verifyTwilioSignature(url, params, request.headers.get("x-twilio-signature"))) {
    return new Response("Invalid signature", { status: 403 })
  }

  const from = params.From ?? ""
  const body = params.Body ?? ""
  const messageSid = params.MessageSid ?? params.SmsSid ?? ""

  // STOP/START opt-out is handled by the Phase 21 preference system elsewhere;
  // here we simply never create an issue from a keyword-only message.
  if (smsKeyword(body)) return twiml()
  if (!from || !body.trim()) return twiml()

  const result = await intakeSmsIssue({ from, body, messageSid }, process.env.CLEANING_SMS_INBOX_ORG_ID ?? null)
  if (!result.filed) {
    if (result.reason === "duplicate") return twiml() // retry of an already-logged message
    return twiml("Thanks — but we couldn't match your number to an account. Please contact the staff directly.")
  }

  return twiml(`Thanks — we logged your report. Reference ${result.reference}. The cleaning team has been notified.`)
}

import { NextResponse } from "next/server"
import { verifyTwilioSignature, smsKeyword } from "@/lib/sms"
import { applyInboundSmsKeyword } from "@/lib/data/notifications"

// PUBLIC Twilio inbound webhook. Signature verification is mandatory — an
// unsigned or wrongly-signed request is rejected. Handles STOP/START opt-out.
export async function POST(request: Request) {
  const raw = await request.text()
  const params = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>
  const signature = request.headers.get("x-twilio-signature")
  // Twilio signs the exact public URL it POSTed to.
  const url = process.env.TWILIO_INBOUND_URL ?? request.url
  if (!verifyTwilioSignature(url, params, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
  }
  const keyword = smsKeyword(params.Body ?? "")
  if (keyword && params.From) await applyInboundSmsKeyword(params.From, keyword)
  // Empty TwiML — acknowledge without auto-replying (Twilio handles STOP copy).
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { "content-type": "text/xml" } })
}

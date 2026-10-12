import { NextResponse } from "next/server"
import { publicQrIssueSchema } from "@/lib/zod-schemas"
import { submitQrIssue } from "@/lib/data/qr-codes"
import { hashIp, isHoneypotTripped, IntakeRejected, clientIpFromHeaders } from "@/lib/public-intake"
import { enforceIpBurst } from "@/lib/rate-limit"

// PUBLIC, unauthenticated write — same hostile-by-default posture as the Phase
// 2.3 quote intake: a pre-DB per-IP token bucket keyed on a trustworthy
// (non-spoofable) IP, a honeypot, and a durable per-IP + per-org row cap in the
// data layer. A missing/revoked token returns a neutral 404.
type Ctx = { params: Promise<{ token: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const { token } = await params

  // 1. PRE-DB per-IP burst guard — a flooding client is rejected before Postgres.
  const ip = clientIpFromHeaders(request.headers)
  try {
    enforceIpBurst(ip)
  } catch (e) {
    if (e instanceof IntakeRejected) return NextResponse.json({ error: e.message }, { status: 429 })
    throw e
  }

  const parsed = publicQrIssueSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Please describe the problem and try again." }, { status: 400 })

  // Honeypot: pretend success, persist nothing.
  if (isHoneypotTripped(parsed.data.website)) return NextResponse.json({ accepted: true, reference: "RECEIVED" })

  try {
    const result = await submitQrIssue(token, parsed.data, hashIp(ip))
    if (!result) return NextResponse.json({ error: "This code is no longer active." }, { status: 404 })
    return NextResponse.json({ accepted: true, reference: result.reference })
  } catch (e) {
    if (e instanceof IntakeRejected) return NextResponse.json({ error: e.message }, { status: 429 })
    throw e
  }
}

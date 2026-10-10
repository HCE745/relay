import { NextResponse } from "next/server"
import { systemDb } from "@/lib/org-db"
import { orgHasCapability } from "@/lib/page-guards"
import { publicQuoteSchema } from "@/lib/zod-schemas"
import { createPublicQuote } from "@/lib/data/quote-requests"
import { hashIp, isHoneypotTripped, IntakeRejected, clientIpFromHeaders } from "@/lib/public-intake"
import { enforceIpBurst, enforceOrgBurst } from "@/lib/rate-limit"

// PUBLIC, unauthenticated write. Hostile by default: a pre-DB per-IP token
// bucket (keyed on a trustworthy, non-spoofable IP), a per-org burst limit, a
// honeypot, a durable per-org DB row cap, and a neutral out-of-area response
// that never reveals exclusions.
type Ctx = { params: Promise<{ slug: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const { slug } = await params

  // 1. PRE-DB per-IP burst guard — a flooding client is rejected before we
  //    touch Postgres. IP comes from a trusted header, so rotating a spoofed
  //    x-forwarded-for no longer changes the caller's identity.
  const ip = clientIpFromHeaders(request.headers)
  try {
    enforceIpBurst(ip)
  } catch (e) {
    if (e instanceof IntakeRejected) return NextResponse.json({ error: e.message }, { status: 429 })
    throw e
  }

  const org = await systemDb.organization.findUnique({ where: { slug }, select: { id: true } })
  if (!org || !(await orgHasCapability(org.id, "crm.quoting"))) {
    return NextResponse.json({ error: "Online booking is not available." }, { status: 404 })
  }
  const parsed = publicQuoteSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 })

  // Honeypot: silently accept (so bots think they succeeded) but persist nothing.
  if (isHoneypotTripped(parsed.data.website)) return NextResponse.json({ accepted: true })

  try {
    enforceOrgBurst(org.id) // per-org burst, before any write path
    const result = await createPublicQuote(org.id, parsed.data, hashIp(ip))
    if (!result.accepted) return NextResponse.json({ accepted: false, reason: "out_of_area" })
    return NextResponse.json({ accepted: true })
  } catch (e) {
    if (e instanceof IntakeRejected) return NextResponse.json({ error: e.message }, { status: 429 })
    throw e
  }
}

import { NextResponse } from "next/server"
import { systemDb } from "@/lib/org-db"
import { orgHasCapability } from "@/lib/page-guards"
import { publicQuoteSchema } from "@/lib/zod-schemas"
import { createPublicQuote } from "@/lib/data/quote-requests"
import { hashIp, isHoneypotTripped, IntakeRejected } from "@/lib/public-intake"

// PUBLIC, unauthenticated write. Hostile by default: honeypot, per-IP + per-org
// rate limits, and a neutral out-of-area response that never reveals exclusions.
type Ctx = { params: Promise<{ slug: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const { slug } = await params
  const org = await systemDb.organization.findUnique({ where: { slug }, select: { id: true } })
  if (!org || !(await orgHasCapability(org.id, "crm.quoting"))) {
    return NextResponse.json({ error: "Online booking is not available." }, { status: 404 })
  }
  const parsed = publicQuoteSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 })

  // Honeypot: silently accept (so bots think they succeeded) but persist nothing.
  if (isHoneypotTripped(parsed.data.website)) return NextResponse.json({ accepted: true })

  const fwd = request.headers.get("x-forwarded-for")
  const ip = (fwd ? fwd.split(",")[0] : null)?.trim() || request.headers.get("x-real-ip") || "0.0.0.0"
  try {
    const result = await createPublicQuote(org.id, parsed.data, hashIp(ip))
    if (!result.accepted) return NextResponse.json({ accepted: false, reason: "out_of_area" })
    return NextResponse.json({ accepted: true })
  } catch (e) {
    if (e instanceof IntakeRejected) return NextResponse.json({ error: e.message }, { status: 429 })
    throw e
  }
}

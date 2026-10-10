import { NextResponse } from "next/server"
import { systemDb } from "@/lib/org-db"
import { orgHasCapability } from "@/lib/page-guards"
import { publicApplicationSchema } from "@/lib/zod-schemas"
import { createPublicApplication } from "@/lib/data/hiring"
import { hashIp, isHoneypotTripped, IntakeRejected, clientIpFromHeaders } from "@/lib/public-intake"
import { enforceIpBurst, enforceOrgBurst } from "@/lib/rate-limit"
type Ctx = { params: Promise<{ slug: string }> }
export async function POST(request: Request, { params }: Ctx) {
  const { slug } = await params
  // Pre-DB per-IP burst guard (trusted, non-spoofable IP).
  const ip = clientIpFromHeaders(request.headers)
  try {
    enforceIpBurst(ip)
  } catch (e) {
    if (e instanceof IntakeRejected) return NextResponse.json({ error: e.message }, { status: 429 })
    throw e
  }
  const org = await systemDb.organization.findUnique({ where: { slug }, select: { id: true } })
  if (!org || !(await orgHasCapability(org.id, "workforce.hiring"))) return NextResponse.json({ error: "Applications are not open." }, { status: 404 })
  const parsed = publicApplicationSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 })
  if (isHoneypotTripped(parsed.data.website)) return NextResponse.json({ accepted: true })
  try {
    enforceOrgBurst(org.id)
    await createPublicApplication(org.id, parsed.data, hashIp(ip))
    return NextResponse.json({ accepted: true })
  } catch (e) {
    if (e instanceof IntakeRejected) return NextResponse.json({ error: e.message }, { status: 429 })
    throw e
  }
}

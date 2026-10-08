import { NextResponse } from "next/server"
import { systemDb } from "@/lib/org-db"
import { orgHasCapability } from "@/lib/page-guards"
import { publicApplicationSchema } from "@/lib/zod-schemas"
import { createPublicApplication } from "@/lib/data/hiring"
import { hashIp, isHoneypotTripped, IntakeRejected } from "@/lib/public-intake"
type Ctx = { params: Promise<{ slug: string }> }
export async function POST(request: Request, { params }: Ctx) {
  const { slug } = await params
  const org = await systemDb.organization.findUnique({ where: { slug }, select: { id: true } })
  if (!org || !(await orgHasCapability(org.id, "workforce.hiring"))) return NextResponse.json({ error: "Applications are not open." }, { status: 404 })
  const parsed = publicApplicationSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 })
  if (isHoneypotTripped(parsed.data.website)) return NextResponse.json({ accepted: true })
  const fwd = request.headers.get("x-forwarded-for")
  const ip = (fwd ? fwd.split(",")[0] : null)?.trim() || request.headers.get("x-real-ip") || "0.0.0.0"
  try {
    await createPublicApplication(org.id, parsed.data, hashIp(ip))
    return NextResponse.json({ accepted: true })
  } catch (e) {
    if (e instanceof IntakeRejected) return NextResponse.json({ error: e.message }, { status: 429 })
    throw e
  }
}

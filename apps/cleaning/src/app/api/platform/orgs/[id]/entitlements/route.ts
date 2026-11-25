import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { isPlatformAdmin } from "@/lib/platform-admin"
import { setOrgCapabilityOverride } from "@/lib/data/platform"

// Platform-admin only. Adjusts an org's per-org capability OVERRIDES (never Stripe
// or the tier). The page and this route both gate on isPlatformAdmin.
type Ctx = { params: Promise<{ id: string }> }
export async function PATCH(request: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session || !isPlatformAdmin(session)) return NextResponse.json({ error: "not found" }, { status: 404 })
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { capability?: string; mode?: string }
  if (!body.capability || !["add", "remove", "default"].includes(body.mode ?? "")) {
    return NextResponse.json({ error: "capability and mode (add|remove|default) required" }, { status: 400 })
  }
  const ok = await setOrgCapabilityOverride(id, body.capability, body.mode as "add" | "remove" | "default", session.email ?? "platform-admin")
  return NextResponse.json(ok ? { updated: true } : { error: "not applied" }, { status: ok ? 200 : 400 })
}

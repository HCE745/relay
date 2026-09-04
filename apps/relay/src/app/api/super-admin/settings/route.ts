import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getPlatformConfig, setPlatformConfig } from "@/lib/platform-config"

async function requireSA() {
  const session = await getSession()
  if (!session?.superAdmin) return null
  return session
}

export async function GET() {
  if (!await requireSA()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const demoAccessCode = await getPlatformConfig("demo_access_code")
  return NextResponse.json({ demoAccessCode })
}

export async function PATCH(req: NextRequest) {
  if (!await requireSA()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { demoAccessCode } = await req.json() as { demoAccessCode: string }
  await setPlatformConfig("demo_access_code", (demoAccessCode ?? "").trim())
  return NextResponse.json({ ok: true })
}

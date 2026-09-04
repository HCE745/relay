import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const ALLOWED_KEYS = new Set(["link_tracking_enabled"])

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

export async function GET() {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const settings = await prisma.salesSetting.findMany()
  const map = Object.fromEntries(settings.map(s => [s.key, s.value]))
  return NextResponse.json({
    link_tracking_enabled: map.link_tracking_enabled ?? "true",
  })
}

export async function PATCH(req: NextRequest) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json() as Record<string, string>
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(key)) continue
    await prisma.salesSetting.upsert({
      where:  { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    })
  }
  return NextResponse.json({ ok: true })
}

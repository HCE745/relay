import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// GET — return singleton CrmSettings (create with defaults if missing)
export async function GET() {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let settings = await prisma.crmSettings.findFirst()
  if (!settings) {
    settings = await prisma.crmSettings.create({ data: {} })
  }
  return NextResponse.json({ settings })
}

// PATCH — update CrmSettings fields
export async function PATCH(req: NextRequest) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as Partial<{
    timezone:           string
    sendingWindowStart: number
    sendingWindowEnd:   number
    autoSendEnabled:    boolean
  }>

  let settings = await prisma.crmSettings.findFirst()
  if (!settings) {
    settings = await prisma.crmSettings.create({ data: {} })
  }

  settings = await prisma.crmSettings.update({
    where: { id: settings.id },
    data:  body,
  })

  return NextResponse.json({ settings })
}

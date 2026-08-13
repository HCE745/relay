import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function getOrCreateSettings() {
  const existing = await prisma.visibilitySetting.findFirst()
  if (existing) return existing
  return prisma.visibilitySetting.create({ data: {} })
}

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const settings = await getOrCreateSettings()
  return NextResponse.json({ settings })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const settings = await getOrCreateSettings()
  const body = await req.json() as {
    mode?: string
    autoFrequency?: string
    autoProviders?: string[]
    maxMonthlyBudgetUsd?: number
  }

  const updated = await prisma.visibilitySetting.update({
    where: { id: settings.id },
    data: {
      ...(body.mode               !== undefined ? { mode:               body.mode as never }               : {}),
      ...(body.autoFrequency      !== undefined ? { autoFrequency:      body.autoFrequency as never }      : {}),
      ...(body.autoProviders      !== undefined ? { autoProviders:      body.autoProviders as never }      : {}),
      ...(body.maxMonthlyBudgetUsd !== undefined ? { maxMonthlyBudgetUsd: body.maxMonthlyBudgetUsd }       : {}),
    },
  })

  return NextResponse.json({ settings: updated })
}

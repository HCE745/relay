import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { resetDemoOrg } from "@/lib/demo-seed"

export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session?.isDemo) {
    return NextResponse.json({ error: "Not a demo session" }, { status: 403 })
  }

  const { name, industry } = await request.json() as { name?: string; industry?: string }

  const trimmedIndustry = industry?.trim()
  const trimmedName     = name?.trim()

  if (!trimmedIndustry && !trimmedName) {
    return NextResponse.json({ error: "No changes" }, { status: 400 })
  }

  // If industry changed, do a full reset with new industry data
  if (trimmedIndustry) {
    const current = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { industry: true },
    })
    if (current?.industry !== trimmedIndustry) {
      await resetDemoOrg(session.organizationId, session.userId, trimmedIndustry)
      if (trimmedName) {
        await prisma.organization.update({
          where: { id: session.organizationId },
          data:  { name: trimmedName },
        })
      }
      return NextResponse.json({ ok: true, reset: true })
    }
  }

  // Name-only change (or same industry)
  const data: { name?: string; industry?: string } = {}
  if (trimmedName)     data.name     = trimmedName
  if (trimmedIndustry) data.industry = trimmedIndustry

  if (Object.keys(data).length > 0) {
    await prisma.organization.update({ where: { id: session.organizationId }, data })
  }
  return NextResponse.json({ ok: true })
}

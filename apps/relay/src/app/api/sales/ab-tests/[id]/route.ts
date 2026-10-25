export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const campaign = await prisma.abTestCampaign.findUnique({
    where: { id },
    include: {
      results: { orderBy: { variant: "asc" } },
      emails: {
        select: {
          id:           true,
          abTestGroup:  true,
          contactEmail: true,
          sentAt:       true,
          openedAt:     true,
          openCount:    true,
          demoCall: { select: { id: true, contactName: true, companyName: true } },
        },
        orderBy: { sentAt: "desc" },
      },
    },
  })

  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Build per-day trend data (last 30 days, grouped by variant)
  const now = new Date()
  const thirtyAgo = new Date(now.getTime() - 30 * 86400_000)
  const trendEmails = campaign.emails.filter(e => e.sentAt >= thirtyAgo)

  const trendMap: Record<string, Record<string, number>> = {}
  for (const email of trendEmails) {
    const day = email.sentAt.toISOString().slice(0, 10)
    const variant = email.abTestGroup ?? "?"
    if (!trendMap[day]) trendMap[day] = {}
    trendMap[day][variant] = (trendMap[day][variant] ?? 0) + 1
  }
  const trend = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }))

  return NextResponse.json({ campaign, trend })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json() as { isActive?: boolean; name?: string }

  const updated = await prisma.abTestCampaign.update({
    where: { id },
    data: {
      ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      ...(body.name ? { name: body.name } : {}),
    },
  })

  return NextResponse.json(updated)
}

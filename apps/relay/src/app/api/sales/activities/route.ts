export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { createSalesActivity } from "@/lib/sales-activities"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const prospectId    = searchParams.get("prospectId")
  const demoCallId    = searchParams.get("demoCallId")
  const opportunityId = searchParams.get("opportunityId")

  if (!prospectId && !demoCallId && !opportunityId) {
    return NextResponse.json({ error: "prospectId, demoCallId, or opportunityId required" }, { status: 400 })
  }

  const activities = await prisma.salesCrmActivity.findMany({
    where: {
      ...(prospectId    ? { prospectId }    : {}),
      ...(demoCallId    ? { demoCallId }    : {}),
      ...(opportunityId ? { opportunityId } : {}),
    },
    include: {
      salesUser: { select: { id: true, name: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 100,
  })

  return NextResponse.json({ activities })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as {
    prospectId?:      string
    demoCallId?:      string
    opportunityId?:   string
    activityType:     string
    subject?:         string
    notes?:           string
    outcome?:         string
    durationMinutes?: number
    occurredAt?:      string
  }

  if (!body.activityType) {
    return NextResponse.json({ error: "activityType required" }, { status: 400 })
  }

  const activity = await createSalesActivity({
    ...body,
    salesUserId: session.salesUserId ?? null,
    occurredAt:  body.occurredAt ? new Date(body.occurredAt) : undefined,
  })

  return NextResponse.json(activity, { status: 201 })
}

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { createSalesActivity } from "@/lib/sales-activities"
import { markOutreachDone, OUTREACH_ACTIVITY_TYPES } from "@/lib/research-progress"

export async function GET(req: NextRequest) {
  const info = await getSalesSession()
  if (!info) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const prospectId    = searchParams.get("prospectId")
  const demoCallId    = searchParams.get("demoCallId")
  const opportunityId = searchParams.get("opportunityId")

  if (!prospectId && !demoCallId && !opportunityId) {
    return NextResponse.json({ error: "prospectId, demoCallId, or opportunityId required" }, { status: 400 })
  }

  // Reps can only fetch activities for their own assigned prospects
  if (!info.isManager && !info.isSuperAdmin && prospectId) {
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { assignedToId: true } })
    if (!prospect || prospect.assignedToId !== info.salesUserId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
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
  const info = await getSalesSession()
  if (!info) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as {
    prospectId?:      string
    demoCallId?:      string
    opportunityId?:   string
    contactId?:       string
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

  const salesUserId = info.isSuperAdmin ? null : info.salesUserId
  const activity = await createSalesActivity({
    ...body,
    salesUserId,
    occurredAt:  body.occurredAt ? new Date(body.occurredAt) : undefined,
  })

  // After a confirmed qualifying outreach, mark research results done server-side
  if (body.prospectId && OUTREACH_ACTIVITY_TYPES.has(body.activityType)) {
    // Need the raw session's superAdminId UUID for research progress tracking
    const rawSession = await getSession()
    await markOutreachDone({
      prospectId:   body.prospectId,
      salesUserId:  salesUserId,
      superAdminId: rawSession?.superAdminId ?? null,
    }).catch(() => {}) // Non-fatal
  }

  return NextResponse.json(activity, { status: 201 })
}

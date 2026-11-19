import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getResearchIdentity, listIsOwner } from "@/lib/research-list-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// ── GET /api/super-admin/crm/prospects/discover/jobs/[id] ────────────────────
// Returns current job status and progress for the polling UI.
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const identity = await getResearchIdentity()
  if (!identity) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const job = await prisma.prospectResearchJob.findUnique({
    where:  { id },
    select: {
      id:              true,
      status:          true,
      listId:          true,
      roundsCompleted: true,
      roundsMax:       true,
      acceptedCount:   true,
      requestedCount:  true,
      country:         true,
      stateProvince:   true,
      industry:        true,
      salesUserId:     true,
      superAdminId:    true,
      inputTokensTotal:  true,
      outputTokensTotal: true,
      searchCallsTotal:  true,
      budgetUsd:         true,
      failedRounds:      true,
      lastError:         true,
      createdAt:         true,
      updatedAt:         true,
    },
  })

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!listIsOwner(job, identity)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json({
    id:                job.id,
    status:            job.status,
    listId:            job.listId,
    roundsCompleted:   job.roundsCompleted,
    roundsMax:         job.roundsMax,
    acceptedCount:     job.acceptedCount,
    requestedCount:    job.requestedCount,
    country:           job.country,
    stateProvince:     job.stateProvince,
    industry:          job.industry,
    inputTokensTotal:  job.inputTokensTotal,
    outputTokensTotal: job.outputTokensTotal,
    searchCallsTotal:  job.searchCallsTotal,
    budgetUsd:         job.budgetUsd,
    failedRounds:      job.failedRounds,
    lastError:         job.lastError,
    createdAt:         job.createdAt,
    updatedAt:         job.updatedAt,
  })
}

// ── PATCH /api/super-admin/crm/prospects/discover/jobs/[id] ──────────────────
// Body: { action: "cancel" }
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const identity = await getResearchIdentity()
  if (!identity) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const job = await prisma.prospectResearchJob.findUnique({
    where:  { id },
    select: { id: true, status: true, salesUserId: true, superAdminId: true },
  })

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!listIsOwner(job, identity)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json() as { action?: string }

  if (body.action === "cancel") {
    if (["completed", "failed", "cancelled"].includes(job.status)) {
      return NextResponse.json({ error: "Job is already terminal" }, { status: 409 })
    }
    const updated = await prisma.prospectResearchJob.update({
      where: { id },
      data:  { status: "cancelled", lockedUntil: null },
      select: { id: true, status: true, listId: true, acceptedCount: true },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: "action must be 'cancel'" }, { status: 400 })
}

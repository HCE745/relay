import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { logSAAction } from "@/lib/sa-audit"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// Status flow:
//   draft → configuring → ready_for_review → ready_to_launch
//                                                ↓ (via /launch)
//                                         invitation_sent → live (SA marks live)
//
// /launch sets invitation_sent; "live" is set here via PATCH from invitation_sent.
// Backward transitions are allowed within the pre-launch section (draft..ready_to_launch).
// Once invitation_sent, the only allowed PATCH transition is → live.
const STATUS_ORDER = ["draft", "configuring", "ready_for_review", "ready_to_launch", "invitation_sent", "live"] as const
type OnboardingStatus = typeof STATUS_ORDER[number]

function isValidTransition(from: string, to: string): boolean {
  // Once live, nothing can change via PATCH
  if (from === "live") return false
  // invitation_sent can only go to live
  if (from === "invitation_sent") return to === "live"
  // live can only be set from invitation_sent (enforced above)
  if (to === "live") return from === "invitation_sent"
  // invitation_sent cannot be set via PATCH (only via /launch)
  if (to === "invitation_sent") return false
  const fi = STATUS_ORDER.indexOf(from as OnboardingStatus)
  const ti = STATUS_ORDER.indexOf(to as OnboardingStatus)
  return fi >= 0 && ti >= 0 && ti !== fi
}

// ── GET /api/super-admin/onboarding/[id] ────────────────────────────────────
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const record = await prisma.customerOnboarding.findUnique({
    where: { id },
    include: {
      organization: {
        select: {
          id: true, name: true, slug: true, plan: true,
          subscriptionStatus: true, trialStartDate: true, trialEndsAt: true,
          createdAt: true,
        },
      },
    },
  })

  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(record)
}

// ── PATCH /api/super-admin/onboarding/[id] ──────────────────────────────────
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const record = await prisma.customerOnboarding.findUnique({
    where: { id },
    include: { organization: { select: { id: true, name: true } } },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (record.status === "live") {
    return NextResponse.json({ error: "This onboarding record is live and read-only" }, { status: 409 })
  }

  const body = await req.json() as {
    status?:                string
    primaryContactName?:    string
    primaryContactEmail?:   string
    plan?:                  string
    estimatedFacilities?:   number
    internalNotes?:         string | null
    trialStartDate?:        string | null
    checklist?:             unknown[]
    checklistToggle?:       { key: string; completed: boolean }
  }

  // Once invitation is sent, only allow the status→live transition; block all field edits.
  if (record.status === "invitation_sent") {
    const hasFieldEdits = [
      body.primaryContactName, body.primaryContactEmail, body.plan,
      body.estimatedFacilities, body.internalNotes, body.trialStartDate,
      body.checklist, body.checklistToggle,
    ].some(v => v !== undefined)

    if (hasFieldEdits) {
      return NextResponse.json(
        { error: "Cannot edit fields after invitation has been sent. Only status transitions are allowed." },
        { status: 409 },
      )
    }
  }

  const data: Record<string, unknown> = {}

  if (body.status !== undefined) {
    if (!isValidTransition(record.status, body.status)) {
      return NextResponse.json(
        { error: `Cannot transition from '${record.status}' to '${body.status}'. Use /launch to go live.` },
        { status: 400 },
      )
    }
    data.status = body.status
    // Record the moment the SA marks the customer live (invitation_sent → live is the only path here).
    // Guard against overwriting in case of a data anomaly where launchedAt is already set.
    if (body.status === "live" && !record.launchedAt) {
      data.launchedAt = new Date()
    }
  }

  if (body.primaryContactName !== undefined) {
    const v = body.primaryContactName.trim()
    if (!v) return NextResponse.json({ error: "primaryContactName cannot be empty" }, { status: 400 })
    data.primaryContactName = v
  }

  if (body.primaryContactEmail !== undefined) {
    const v = body.primaryContactEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return NextResponse.json({ error: "primaryContactEmail is not a valid email" }, { status: 400 })
    }
    data.primaryContactEmail = v
  }

  if (body.plan !== undefined)                data.plan = body.plan
  if (typeof body.estimatedFacilities === "number") data.estimatedFacilities = body.estimatedFacilities
  if ("internalNotes" in body)                data.internalNotes = body.internalNotes ?? null
  if ("trialStartDate" in body) {
    data.trialStartDate = body.trialStartDate ? new Date(body.trialStartDate) : null
  }

  // Replace full checklist array
  if (Array.isArray(body.checklist)) {
    data.checklist = body.checklist
  }

  // Toggle a single checklist item by key
  if (body.checklistToggle) {
    const { key, completed } = body.checklistToggle
    const list = (record.checklist as Array<{
      key: string; label: string; completedAt: string | null; completedByName: string | null
    }>).map(item =>
      item.key === key
        ? {
            ...item,
            completedAt:     completed ? new Date().toISOString() : null,
            completedByName: completed ? session.name : null,
          }
        : item,
    )
    data.checklist = list
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 })
  }

  data.updatedAt = new Date()

  const updated = await prisma.customerOnboarding.update({
    where: { id },
    data,
    include: {
      organization: { select: { id: true, name: true, subscriptionStatus: true } },
    },
  })

  await logSAAction({
    superAdminId:   session.superAdminId!,
    superAdminName: session.name,
    action:         "UPDATE_CUSTOMER_ONBOARDING",
    orgId:          record.organization.id,
    orgName:        record.organization.name,
    targetType:     "organization",
    targetId:       id,
    targetName:     record.organization.name,
    before: { status: record.status },
    after:  data,
  })

  return NextResponse.json(updated)
}

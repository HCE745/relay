import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

type ReadinessItem = {
  key:         string
  label:       string
  required:    boolean
  passed:      boolean
  detail?:     string
}

// ── GET /api/super-admin/onboarding/[id]/configure/readiness ─────────────────
//
// Returns the pre-launch readiness checklist.
//
// Hard gates (required=true): primary contact email, trial start date.
// Advisory (required=false): at least one location, one QR code, one department.
//
// The existing /launch endpoint requires status = "ready_to_launch" and
// trialStartDate. This readiness check does NOT replace that; it shows the SA
// what still needs attention before they advance the status.
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const record = await prisma.customerOnboarding.findUnique({
    where: { id },
    include: { organization: { select: { id: true, name: true } } },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const orgId = record.organizationId

  const [locationCount, qrCodeCount, deptCount] = await Promise.all([
    prisma.location.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.qrCode.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.department.count({ where: { organizationId: orgId } }),
  ])

  const items: ReadinessItem[] = [
    {
      key:      "primary_contact_email",
      label:    "Primary contact email is set",
      required: true,
      passed:   !!record.primaryContactEmail?.trim(),
    },
    {
      key:      "trial_start_date",
      label:    "Trial start date is set",
      required: true,
      passed:   !!record.trialStartDate,
      detail:   record.trialStartDate
        ? `Trial starts ${record.trialStartDate.toISOString().slice(0, 10)}`
        : "Required by /launch",
    },
    {
      key:    "has_location",
      label:  "At least one location configured",
      required: false,
      passed:   locationCount > 0,
      detail:   `${locationCount} location${locationCount === 1 ? "" : "s"} configured`,
    },
    {
      key:    "has_qr_code",
      label:  "At least one QR code created",
      required: false,
      passed:   qrCodeCount > 0,
      detail:   `${qrCodeCount} QR code${qrCodeCount === 1 ? "" : "s"} created`,
    },
    {
      key:    "has_department",
      label:  "At least one department configured",
      required: false,
      passed:   deptCount > 0,
      detail:   `${deptCount} department${deptCount === 1 ? "" : "s"} configured`,
    },
  ]

  const requiredFailed = items.filter(i => i.required && !i.passed)
  const ready          = requiredFailed.length === 0

  return NextResponse.json({
    ready,
    status:         record.status,
    requiredFailed: requiredFailed.map(i => i.label),
    items,
  })
}

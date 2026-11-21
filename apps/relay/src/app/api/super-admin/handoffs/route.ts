import "server-only"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// ── GET /api/super-admin/handoffs ────────────────────────────────────────────
// List handoffs. Default filter: pending_review. Supports ?status=all|<value>.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get("status") // "all" | specific status

  const where = statusParam === "all" ? {} : { status: statusParam ?? "pending_review" }

  const handoffs = await prisma.onboardingHandoff.findMany({
    where,
    orderBy: { createdAt: "asc" }, // oldest-first for the queue
    select: {
      id: true,
      companyName: true,
      onboardingType: true,
      isTest: true,
      status: true,
      plan: true,
      estimatedFacilities: true,
      trialStartDate: true,
      submittedById: true,
      submittedByName: true,
      reviewedAt: true,
      rejectionReason: true,
      customerOnboardingId: true,
      createdAt: true,
      updatedAt: true,
      prospect: {
        select: { id: true, companyName: true, onboardingStatus: true, relayOrganizationId: true },
      },
      opportunity: {
        select: { id: true, title: true, stage: true, assignedToId: true },
      },
    },
  })

  return NextResponse.json(handoffs)
}

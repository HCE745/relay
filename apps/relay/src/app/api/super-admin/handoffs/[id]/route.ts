import "server-only"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

// ── GET /api/super-admin/handoffs/[id] ───────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const handoff = await prisma.onboardingHandoff.findUnique({
    where: { id },
    select: {
      id: true,
      companyName: true,
      primaryContactName: true,
      primaryContactEmail: true,
      primaryContactPhone: true,
      onboardingType: true,
      isTest: true,
      plan: true,
      estimatedFacilities: true,
      trialStartDate: true,
      salesNotes: true,
      customerAgreementConfirmed: true,
      status: true,
      submittedById: true,
      submittedByName: true,
      reviewedById: true,
      reviewedByName: true,
      reviewedAt: true,
      rejectionReason: true,
      customerOnboardingId: true,
      createdAt: true,
      updatedAt: true,
      prospect: {
        select: {
          id: true, companyName: true, website: true, industry: true,
          headquartersCity: true, headquartersState: true,
          onboardingStatus: true, relayOrganizationId: true,
          contacts: {
            take: 3,
            select: { id: true, name: true, title: true, email: true, phone: true },
          },
        },
      },
      opportunity: {
        select: {
          id: true, title: true, stage: true, product: true,
          value: true, estimatedValue: true, closeDate: true,
          assignedToId: true, qualificationStatus: true,
          leadSource: true, notes: true,
        },
      },
    },
  })

  if (!handoff) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(handoff)
}

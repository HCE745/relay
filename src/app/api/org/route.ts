import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { name, industry } = await request.json()
  const org = await prisma.organization.update({
    where: { id: session.organizationId },
    data: { name: name || undefined, industry: industry || null },
  })
  return NextResponse.json(org)
}

export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const {
    purchaseRequestEnabled,
    purchaseRequestItemLimit,
    purchaseRequestMonthlyLimit,
    injuryAlertEmails,
    sopMatchSensitivity,
    approval_intelligence_enabled,
    ai_suggest_unmatched_items,
    ai_confidence_threshold,
  } = body

  const VALID_SENSITIVITIES = ["LOW", "MEDIUM", "HIGH"]
  if (sopMatchSensitivity !== undefined && !VALID_SENSITIVITIES.includes(sopMatchSensitivity)) {
    return NextResponse.json({ error: "Invalid sopMatchSensitivity" }, { status: 400 })
  }

  const org = await prisma.organization.update({
    where: { id: session.organizationId },
    data: {
      ...(purchaseRequestEnabled    !== undefined ? { purchaseRequestEnabled }    : {}),
      ...(purchaseRequestItemLimit  !== undefined ? { purchaseRequestItemLimit: purchaseRequestItemLimit === "" || purchaseRequestItemLimit === null ? null : Number(purchaseRequestItemLimit) }  : {}),
      ...(purchaseRequestMonthlyLimit !== undefined ? { purchaseRequestMonthlyLimit: purchaseRequestMonthlyLimit === "" || purchaseRequestMonthlyLimit === null ? null : Number(purchaseRequestMonthlyLimit) } : {}),
      ...(injuryAlertEmails         !== undefined ? { injuryAlertEmails }         : {}),
      ...(sopMatchSensitivity       !== undefined ? { sopMatchSensitivity }       : {}),
      ...(approval_intelligence_enabled !== undefined ? { approval_intelligence_enabled: Boolean(approval_intelligence_enabled) } : {}),
      ...(ai_suggest_unmatched_items    !== undefined ? { ai_suggest_unmatched_items: Boolean(ai_suggest_unmatched_items) }        : {}),
      ...(ai_confidence_threshold       !== undefined ? { ai_confidence_threshold: Number(ai_confidence_threshold) }              : {}),
    },
    select: {
      purchaseRequestEnabled: true,
      purchaseRequestItemLimit: true,
      purchaseRequestMonthlyLimit: true,
      injuryAlertEmails: true,
      sopMatchSensitivity: true,
      approval_intelligence_enabled: true,
      ai_suggest_unmatched_items: true,
      ai_confidence_threshold: true,
    },
  })
  return NextResponse.json(org)
}

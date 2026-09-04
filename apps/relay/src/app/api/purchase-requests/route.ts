import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

async function analyzePhotoWithAI(photoUrl: string, itemName: string, itemDescription: string | null): Promise<{
  verified: boolean
  confidence: number
  analysis: string
} | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const descStr = itemDescription ? `\nDescription: ${itemDescription}` : ""

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: photoUrl },
            },
            {
              type: "text",
              text: `Analyze this workplace asset photo. The employee is requesting a purchase/replacement for: "${itemName}"${descStr}.

Respond with a JSON object (no markdown, just JSON):
{
  "damaged": true/false,
  "confidence": 0.0-1.0,
  "analysis": "one sentence describing what you see and whether damage is evident"
}`,
            },
          ],
        }],
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) return null
    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    const text = data.content.find(c => c.type === "text")?.text?.trim()
    if (!text) return null

    const parsed = JSON.parse(text) as { damaged: boolean; confidence: number; analysis: string }
    return {
      verified: parsed.damaged === true,
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0)),
      analysis: parsed.analysis ?? "Analysis unavailable.",
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canViewAll = ["ADMIN", "MANAGER"].includes(session.role)
  const { searchParams } = req.nextUrl
  const status = searchParams.get("status") || undefined

  const requests = await prisma.purchaseRequest.findMany({
    where: {
      organizationId: session.organizationId,
      ...(canViewAll ? {} : { submittedById: session.userId }),
      ...(status ? { status } : {}),
    },
    include: {
      submittedBy: { select: { id: true, name: true } },
      approvedBy:  { select: { id: true, name: true } },
      asset:       { select: { id: true, name: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      purchaseRequestEnabled:       true,
      purchaseRequestItemLimit:     true,
      purchaseRequestMonthlyLimit:  true,
      approval_intelligence_enabled: true,
    },
  })

  // ── Approval Intelligence path ─────────────────────────────────────────────
  if (org?.approval_intelligence_enabled) {
    return handleApprovalIntelligenceSubmit(req, session, body, org)
  }

  // ── Legacy path (unchanged) ────────────────────────────────────────────────
  const { itemName, itemDescription, estimatedCost, photoUrl, assetId, notes } = body

  if (!itemName?.trim()) {
    return NextResponse.json({ error: "Item name is required" }, { status: 400 })
  }

  if (!org?.purchaseRequestEnabled) {
    return NextResponse.json({ error: "Purchase requests are not enabled for this organization" }, { status: 403 })
  }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const monthlySpend = await prisma.purchaseRequest.aggregate({
    where: {
      organizationId: session.organizationId,
      submittedById:  session.userId,
      status: { in: ["APPROVED", "AI_APPROVED"] },
      createdAt: { gte: monthStart },
    },
    _sum: { estimatedCost: true },
  })

  const spentThisMonth = monthlySpend._sum.estimatedCost ?? 0
  const estimatedCostNum = estimatedCost ? Number(estimatedCost) : null

  let aiResult: { verified: boolean; confidence: number; analysis: string } | null = null
  if (photoUrl) {
    aiResult = await analyzePhotoWithAI(photoUrl, itemName, itemDescription ?? null)
  }

  let status = "PENDING"
  let autoApproved = false

  if (aiResult) {
    const withinItemLimit = !org.purchaseRequestItemLimit || !estimatedCostNum || estimatedCostNum <= org.purchaseRequestItemLimit
    const withinMonthlyLimit = !org.purchaseRequestMonthlyLimit || !estimatedCostNum ||
      (spentThisMonth + estimatedCostNum) <= org.purchaseRequestMonthlyLimit

    if (aiResult.verified && aiResult.confidence >= 0.75 && withinItemLimit && withinMonthlyLimit) {
      status = "AI_APPROVED"
      autoApproved = true
    } else if (!aiResult.verified) {
      status = "NEEDS_REVIEW"
    }
  }

  const request = await prisma.purchaseRequest.create({
    data: {
      organizationId:  session.organizationId,
      submittedById:   session.userId,
      itemName:        itemName.trim(),
      itemDescription: itemDescription?.trim() || null,
      estimatedCost:   estimatedCostNum,
      photoUrl:        photoUrl || null,
      assetId:         assetId || null,
      notes:           notes?.trim() || null,
      aiVerified:      aiResult?.verified ?? false,
      aiConfidence:    aiResult?.confidence ?? null,
      aiAnalysis:      aiResult?.analysis ?? null,
      status,
    },
    include: {
      submittedBy: { select: { id: true, name: true } },
      asset:       { select: { id: true, name: true, type: true } },
    },
  })

  if (!autoApproved) {
    const reviewers = await prisma.user.findMany({
      where: { organizationId: session.organizationId, isActive: true, role: { in: ["ADMIN", "MANAGER"] } },
      select: { id: true },
    })
    if (reviewers.length > 0) {
      await prisma.notification.createMany({
        data: reviewers.map(u => ({
          userId:         u.id,
          organizationId: session.organizationId,
          type:           "PURCHASE_REQUEST",
          title:          "Purchase Request Needs Review",
          message:        `${request.submittedBy.name} submitted a request for "${itemName}"${estimatedCostNum ? ` (~$${estimatedCostNum})` : ""}.`,
        })),
      })
    }
  }

  return NextResponse.json({ ...request, autoApproved }, { status: 201 })
}

// ── Approval Intelligence submission handler ────────────────────────────────
async function handleApprovalIntelligenceSubmit(
  _req: NextRequest,
  session: { userId: string; organizationId: string; name: string; role: string },
  body: Record<string, unknown>,
  _org: unknown
) {
  const {
    itemName, itemDescription, estimatedCost, assetId, notes,
    photoData,
    // AI analysis results (pre-computed in step 2)
    catalogItemId, approvalPolicyId, aiItemIdentified, aiMatchConfidence,
    aiDamageAssessment, aiReasoning, approvalPath, vendorSku, replacementUrl,
  } = body as {
    itemName: string
    itemDescription?: string
    estimatedCost?: number
    assetId?: string
    notes?: string
    photoData?: string[]
    catalogItemId?: string
    approvalPolicyId?: string
    aiItemIdentified?: string
    aiMatchConfidence?: number
    aiDamageAssessment?: string
    aiReasoning?: string
    approvalPath?: string
    vendorSku?: string
    replacementUrl?: string
  }

  if (!itemName?.trim()) {
    return NextResponse.json({ error: "Item name is required" }, { status: 400 })
  }

  const referenceNumber = "PR-" + Date.now().toString(36).toUpperCase().slice(-6)

  const status =
    approvalPath === "AUTO_APPROVE" ? "AUTO_APPROVED" :
    "AWAITING_APPROVAL"

  const estimatedCostNum = estimatedCost ? Number(estimatedCost) : null

  const request = await prisma.purchaseRequest.create({
    data: {
      organizationId:    session.organizationId,
      submittedById:     session.userId,
      itemName:          itemName.trim(),
      itemDescription:   itemDescription?.trim() || null,
      estimatedCost:     estimatedCostNum,
      assetId:           assetId || null,
      notes:             notes?.trim() || null,
      photoData:         photoData ?? [],
      status,
      referenceNumber,
      catalogItemId:     catalogItemId || null,
      approvalPolicyId:  approvalPolicyId || null,
      aiItemIdentified:  aiItemIdentified || null,
      aiMatchConfidence: aiMatchConfidence ?? null,
      aiDamageAssessment: aiDamageAssessment || null,
      aiReasoning:       aiReasoning || null,
      approvalPath:      approvalPath || null,
      vendorSku:         vendorSku || null,
      replacementUrl:    replacementUrl || null,
      currentApproverRole: approvalPath === "AUTO_APPROVE" ? null :
        approvalPath === "SUPERVISOR"        ? "SUPERVISOR" :
        approvalPath === "DEPARTMENT_MANAGER" ? "MANAGER" : "ADMIN",
    },
    include: {
      submittedBy: { select: { id: true, name: true } },
      catalogItem: { select: { id: true, name: true } },
      asset:       { select: { id: true, name: true, type: true } },
    },
  })

  if (status === "AUTO_APPROVED") {
    // Notify submitter
    await prisma.notification.create({
      data: {
        userId:         session.userId,
        organizationId: session.organizationId,
        type:           "PURCHASE_REQUEST",
        title:          "Purchase Request Auto-Approved",
        message:        `Your request for "${itemName}" (${referenceNumber}) was automatically approved per company policy.`,
      },
    })
    // Notify purchasing/admin
    const admins = await prisma.user.findMany({
      where: { organizationId: session.organizationId, isActive: true, role: "ADMIN" },
      select: { id: true },
    })
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(u => ({
          userId:         u.id,
          organizationId: session.organizationId,
          type:           "PURCHASE_REQUEST",
          title:          "Auto-Approved Purchase Request",
          message:        `${session.name}'s request for "${itemName}" (${referenceNumber}) was auto-approved. A purchase request document is ready.`,
        })),
      })
    }
  } else {
    // Route to the right approvers
    const approverRole =
      approvalPath === "SUPERVISOR"         ? ["SUPERVISOR", "MANAGER", "ADMIN"] :
      approvalPath === "DEPARTMENT_MANAGER" ? ["MANAGER", "ADMIN"] :
      ["ADMIN"]

    const approvers = await prisma.user.findMany({
      where: { organizationId: session.organizationId, isActive: true, role: { in: approverRole } },
      select: { id: true },
    })
    if (approvers.length > 0) {
      await prisma.notification.createMany({
        data: approvers.map(u => ({
          userId:         u.id,
          organizationId: session.organizationId,
          type:           "PURCHASE_REQUEST",
          title:          "Purchase Request Needs Approval",
          message:        `${session.name} submitted "${itemName}" (${referenceNumber})${estimatedCostNum ? ` — $${estimatedCostNum}` : ""} for your approval.`,
        })),
      })
    }
  }

  return NextResponse.json({ ...request, autoApproved: status === "AUTO_APPROVED" }, { status: 201 })
}

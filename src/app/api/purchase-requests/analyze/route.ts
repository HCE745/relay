import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// Returns AI analysis + catalog match + approval path determination
// Called BEFORE the final purchase request is submitted (step 2 of the flow)

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    description: string
    photos?: string[]          // base64 data URLs
    assetId?: string
    departmentId?: string
    locationId?: string
    estimatedCost?: number
  }

  const { description, photos = [], assetId, departmentId, locationId, estimatedCost } = body

  if (!description?.trim()) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      approval_intelligence_enabled: true,
      ai_suggest_unmatched_items:    true,
      ai_confidence_threshold:       true,
    },
  })

  if (!org?.approval_intelligence_enabled) {
    return NextResponse.json({ error: "Approval Intelligence is not enabled" }, { status: 403 })
  }

  // If asset QR was scanned, use asset data (takes priority over AI)
  let assetPreFill: AssetPreFill | null = null
  if (assetId) {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organizationId: session.organizationId },
      select: {
        id: true, name: true, model: true, serialNumber: true,
        manufacturer: true,
        vendor: { select: { id: true, name: true } },
      },
    })
    if (asset) {
      assetPreFill = {
        assetName:    asset.name,
        model:        asset.model,
        serialNumber: asset.serialNumber,
        manufacturer: asset.manufacturer,
        vendorId:     asset.vendor?.id ?? null,
        vendorName:   asset.vendor?.name ?? null,
      }
    }
  }

  // Load catalog items for matching
  const catalogItems = await prisma.approvedCatalogItem.findMany({
    where: { organizationId: session.organizationId, isActive: true },
    select: {
      id: true, name: true, category: true, description: true,
      manufacturer: true, modelNumber: true, estimatedCost: true,
      vendorSku: true, replacementUrl: true, autoApproveBelow: true,
      approvalPolicyId: true,
      preferredVendor: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  })

  // AI identification
  const aiResult = await identifyItemWithAI({
    description,
    photos,
    assetPreFill,
    catalogItems,
    canSuggestUnmatched: org.ai_suggest_unmatched_items,
  })

  // Determine matched catalog item
  const matchedItem = aiResult.catalogItemId
    ? catalogItems.find(c => c.id === aiResult.catalogItemId) ?? null
    : null

  // Determine approval path
  const cost = estimatedCost ?? matchedItem?.estimatedCost ?? null
  const vendorId = matchedItem?.preferredVendor?.id ?? null
  const category = matchedItem?.category ?? "GENERAL"

  const { approvalPath, policyId, policyName, matchedConditions, reason: policyReason } =
    await resolveApprovalPath({
      organizationId: session.organizationId,
      amount:         cost,
      category,
      departmentId:   departmentId ?? null,
      locationId:     locationId ?? null,
      vendorId,
      catalogItem:    matchedItem ? { approvalPolicyId: matchedItem.approvalPolicyId, autoApproveBelow: matchedItem.autoApproveBelow } : null,
    })

  // Below-confidence flag
  const belowThreshold = aiResult.matchConfidence < (org.ai_confidence_threshold ?? 0.8)

  const expectedOutcome =
    belowThreshold
      ? "Flagged for Human Review (low confidence)"
      : approvalPath === "AUTO_APPROVE"
      ? "Auto-Approved"
      : approvalPath === "SUPERVISOR"
      ? "Requires Supervisor Approval"
      : approvalPath === "DEPARTMENT_MANAGER"
      ? "Requires Department Manager Approval"
      : "Requires Purchasing Department Approval"

  return NextResponse.json({
    // AI identification
    aiItemIdentified:    aiResult.itemName,
    aiMatchConfidence:   aiResult.matchConfidence,
    aiDamageAssessment:  aiResult.damageAssessment,
    aiReasoning:         aiResult.reasoning,
    belowConfidenceThreshold: belowThreshold,

    // Catalog match
    catalogItemId:   matchedItem?.id ?? null,
    catalogItemName: matchedItem?.name ?? null,
    estimatedCost:   cost,
    vendorName:      matchedItem?.preferredVendor?.name ?? null,
    vendorSku:       matchedItem?.vendorSku ?? null,
    replacementUrl:  matchedItem?.replacementUrl ?? null,
    category,

    // Approval path
    approvalPath,
    policyId:   policyId ?? null,
    policyName: policyName ?? null,
    matchedConditions: matchedConditions ?? [],
    policyReason,
    expectedOutcome,

    // Asset prefill (if applicable)
    assetPreFill,
  })
}

interface AssetPreFill {
  assetName:    string
  model:        string | null
  serialNumber: string | null
  manufacturer: string | null
  vendorId:     string | null
  vendorName:   string | null
}

interface CatalogItemRef {
  id: string
  name: string
  category: string
  description: string | null
  manufacturer: string | null
  modelNumber: string | null
  estimatedCost: number | null
  vendorSku: string | null
  replacementUrl: string | null
  autoApproveBelow: number | null
  approvalPolicyId: string | null
  preferredVendor: { id: string; name: string } | null
}

async function identifyItemWithAI(opts: {
  description: string
  photos: string[]
  assetPreFill: AssetPreFill | null
  catalogItems: CatalogItemRef[]
  canSuggestUnmatched: boolean
}): Promise<{
  itemName: string
  matchConfidence: number
  catalogItemId: string | null
  damageAssessment: string
  reasoning: string
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || opts.catalogItems.length === 0) {
    // No AI available — return low confidence result for manual review
    return {
      itemName:      opts.assetPreFill?.assetName ?? "Unknown item",
      matchConfidence: 0,
      catalogItemId: null,
      damageAssessment: "INCONCLUSIVE",
      reasoning: "AI analysis is unavailable. This request has been flagged for manual review.",
    }
  }

  const catalogList = opts.catalogItems
    .map(c => `ID:${c.id} | ${c.name} | ${c.category}${c.manufacturer ? ` | ${c.manufacturer}` : ""}${c.modelNumber ? ` ${c.modelNumber}` : ""}`)
    .join("\n")

  const assetContext = opts.assetPreFill
    ? `\nAsset on record: ${opts.assetPreFill.assetName}${opts.assetPreFill.model ? ` (${opts.assetPreFill.model})` : ""}${opts.assetPreFill.serialNumber ? `, S/N: ${opts.assetPreFill.serialNumber}` : ""}`
    : ""

  const prompt = `You are an Approval Intelligence assistant for a facilities management platform. Your job is to identify what item an employee needs, match it to the organization's approved catalog, and assess any visible damage.

Employee description: "${opts.description}"${assetContext}

Approved Item Catalog (${opts.catalogItems.length} items):
${catalogList}

${opts.photos.length > 0 ? "Photos have been submitted (analyzed below)." : "No photos submitted."}

Respond with ONLY a JSON object — no markdown, no commentary:
{
  "itemName": "the name of the item being requested",
  "catalogItemId": "ID from catalog above, or null if no confident match",
  "matchConfidence": 0.0-1.0,
  "damageAssessment": "CONFIRMED" | "NOT_VISIBLE" | "INCONCLUSIVE",
  "reasoning": "2-3 sentences in plain English: what item you identified, why you matched (or didn't match) the catalog item, and what the damage assessment is based on"
}`

  try {
    const content: object[] = [{ type: "text", text: prompt }]

    // Add photo(s) if provided (max 3 for cost control)
    for (const photoDataUrl of opts.photos.slice(0, 3)) {
      const match = photoDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)
      if (!match) continue
      content.push({
        type: "image",
        source: {
          type:       "base64",
          media_type: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data:       match[2],
        },
      })
    }
    if (opts.photos.length > 0) {
      content.push({ type: "text", text: "Analyze the above photos to identify the item and assess visible damage." })
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages:   [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) throw new Error(`Anthropic error ${res.status}`)
    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    const text = data.content.find(c => c.type === "text")?.text?.trim() ?? ""

    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    const parsed = JSON.parse(jsonText) as {
      itemName: string
      catalogItemId: string | null
      matchConfidence: number
      damageAssessment: string
      reasoning: string
    }

    // Validate catalogItemId is actually in our catalog
    const validId = opts.catalogItems.find(c => c.id === parsed.catalogItemId)?.id ?? null

    return {
      itemName:         parsed.itemName ?? "Unknown item",
      matchConfidence:  Math.max(0, Math.min(1, parsed.matchConfidence ?? 0)),
      catalogItemId:    validId,
      damageAssessment: ["CONFIRMED", "NOT_VISIBLE", "INCONCLUSIVE"].includes(parsed.damageAssessment)
        ? parsed.damageAssessment
        : "INCONCLUSIVE",
      reasoning: parsed.reasoning ?? "Analysis unavailable.",
    }
  } catch {
    return {
      itemName:         opts.assetPreFill?.assetName ?? "Unknown item",
      matchConfidence:  0,
      catalogItemId:    null,
      damageAssessment: "INCONCLUSIVE",
      reasoning:        "AI analysis failed. This request has been flagged for manual review.",
    }
  }
}

async function resolveApprovalPath(opts: {
  organizationId: string
  amount: number | null
  category: string
  departmentId: string | null
  locationId: string | null
  vendorId: string | null
  catalogItem: { approvalPolicyId: string | null; autoApproveBelow: number | null } | null
}): Promise<{
  approvalPath: string
  policyId: string | null
  policyName: string | null
  matchedConditions: string[]
  reason: string
}> {
  // Catalog item override
  if (opts.catalogItem?.autoApproveBelow != null && opts.amount != null && opts.amount <= opts.catalogItem.autoApproveBelow) {
    return {
      approvalPath: "AUTO_APPROVE",
      policyId: null, policyName: null, matchedConditions: [],
      reason: `Auto-approved: amount ($${opts.amount}) is within the catalog item's auto-approve threshold ($${opts.catalogItem.autoApproveBelow}).`,
    }
  }

  type PolicyWithRules = { id: string; name: string; escalateAfterHours: number; rules: PolicyRule[] }

  // Find policy
  let policy: PolicyWithRules | null = null

  if (opts.catalogItem?.approvalPolicyId) {
    const p = await prisma.approvalPolicy.findUnique({
      where: { id: opts.catalogItem.approvalPolicyId },
      include: { rules: { orderBy: { priority: "asc" } } },
    })
    if (p) policy = p as unknown as PolicyWithRules
  }

  if (!policy) {
    const p = await prisma.approvalPolicy.findFirst({
      where: { organizationId: opts.organizationId, isDefault: true },
      include: { rules: { orderBy: { priority: "asc" } } },
    })
    if (p) policy = p as unknown as PolicyWithRules
  }

  if (!policy) {
    return {
      approvalPath: "SUPERVISOR",
      policyId: null, policyName: null, matchedConditions: [],
      reason: "No approval policy configured. Defaulting to supervisor approval.",
    }
  }

  const amt = opts.amount

  for (const rule of policy.rules) {
    if (rule.minAmount != null && (amt == null || amt < rule.minAmount)) continue
    if (rule.maxAmount != null && (amt == null || amt > rule.maxAmount)) continue
    if (rule.category    && rule.category    !== opts.category)    continue
    if (rule.departmentId && rule.departmentId !== opts.departmentId) continue
    if (rule.locationId  && rule.locationId  !== opts.locationId)  continue
    if (rule.vendorId    && rule.vendorId    !== opts.vendorId)    continue

    const conditions: string[] = []
    if (rule.minAmount != null && rule.maxAmount != null)
      conditions.push(`$${rule.minAmount}–$${rule.maxAmount}`)
    else if (rule.minAmount != null)
      conditions.push(`≥ $${rule.minAmount}`)
    else if (rule.maxAmount != null)
      conditions.push(`≤ $${rule.maxAmount}`)
    if (rule.category)     conditions.push(`category: ${rule.category}`)
    if (rule.departmentId) conditions.push("department match")
    if (rule.locationId)   conditions.push("location match")
    if (rule.vendorId)     conditions.push("vendor match")

    return {
      approvalPath:     rule.approvalPath,
      policyId:         policy.id,
      policyName:       policy.name,
      matchedConditions: conditions,
      reason: `Policy "${policy.name}" rule matched on: ${conditions.length ? conditions.join(", ") : "default rule"}.`,
    }
  }

  return {
    approvalPath: "SUPERVISOR",
    policyId:     policy.id,
    policyName:   policy.name,
    matchedConditions: [],
    reason: `Policy "${policy.name}" has no specific matching rule. Defaulting to supervisor approval.`,
  }
}

interface PolicyRule {
  id: string
  priority: number
  minAmount: number | null
  maxAmount: number | null
  category: string | null
  departmentId: string | null
  locationId: string | null
  vendorId: string | null
  approvalPath: string
  escalateAfterHours: number | null
}

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// Given a hypothetical item, returns which policy + rule would apply and what outcome it would produce
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { amount, category, departmentId, locationId, vendorId, catalogItemId } = await req.json()

  let catalogItem: { approvalPolicyId: string | null; autoApproveBelow: number | null; name: string; estimatedCost: number | null } | null = null
  if (catalogItemId) {
    catalogItem = await prisma.approvedCatalogItem.findFirst({
      where: { id: catalogItemId, organizationId: session.organizationId },
      select: { approvalPolicyId: true, autoApproveBelow: true, name: true, estimatedCost: true },
    })
  }

  // Check catalog item override first
  if (catalogItem?.autoApproveBelow != null && amount != null && Number(amount) <= catalogItem.autoApproveBelow) {
    return NextResponse.json({
      source: "catalog_item_override",
      reason: `The catalog item "${catalogItem.name}" has an auto-approve override for amounts ≤ $${catalogItem.autoApproveBelow}.`,
      approvalPath: "AUTO_APPROVE",
      policyName: null,
      ruleName: null,
    })
  }

  // Find applicable policy
  let policy = null
  if (catalogItem?.approvalPolicyId) {
    policy = await prisma.approvalPolicy.findUnique({
      where: { id: catalogItem.approvalPolicyId },
      include: { rules: { orderBy: { priority: "asc" } } },
    })
  }

  if (!policy) {
    policy = await prisma.approvalPolicy.findFirst({
      where: { organizationId: session.organizationId, isDefault: true },
      include: { rules: { orderBy: { priority: "asc" } } },
    })
  }

  if (!policy) {
    return NextResponse.json({
      source: "no_policy",
      reason: "No approval policy is configured for this organization. All requests require manual review.",
      approvalPath: "SUPERVISOR",
      policyName: null,
      ruleName: null,
    })
  }

  // Evaluate rules in priority order
  const amt = amount != null ? Number(amount) : null
  for (const rule of policy.rules) {
    if (rule.minAmount != null && (amt == null || amt < rule.minAmount)) continue
    if (rule.maxAmount != null && (amt == null || amt > rule.maxAmount)) continue
    if (rule.category    && rule.category    !== category)    continue
    if (rule.departmentId && rule.departmentId !== departmentId) continue
    if (rule.locationId  && rule.locationId  !== locationId)  continue
    if (rule.vendorId    && rule.vendorId    !== vendorId)    continue

    const conditions: string[] = []
    if (rule.minAmount != null || rule.maxAmount != null) {
      if (rule.minAmount != null && rule.maxAmount != null)
        conditions.push(`amount between $${rule.minAmount} and $${rule.maxAmount}`)
      else if (rule.minAmount != null)
        conditions.push(`amount ≥ $${rule.minAmount}`)
      else
        conditions.push(`amount ≤ $${rule.maxAmount}`)
    }
    if (rule.category)     conditions.push(`category is "${rule.category}"`)
    if (rule.departmentId) conditions.push("specific department match")
    if (rule.locationId)   conditions.push("specific location match")
    if (rule.vendorId)     conditions.push("specific vendor match")

    return NextResponse.json({
      source: "policy_rule",
      policyName: policy.name,
      policyId: policy.id,
      ruleName: `Rule ${rule.priority}: ${rule.approvalPath}`,
      approvalPath: rule.approvalPath,
      escalateAfterHours: rule.escalateAfterHours ?? policy.escalateAfterHours,
      matchedConditions: conditions,
      reason: `Matched policy "${policy.name}" rule #${rule.priority} because: ${conditions.length ? conditions.join(", ") : "it is the first matching rule (no specific conditions)"}.`,
    })
  }

  // No rule matched → fall back to default escalation
  return NextResponse.json({
    source: "policy_default",
    policyName: policy.name,
    policyId: policy.id,
    approvalPath: "SUPERVISOR",
    reason: `No specific rule in policy "${policy.name}" matched this request. Defaulting to supervisor approval.`,
    matchedConditions: [],
  })
}

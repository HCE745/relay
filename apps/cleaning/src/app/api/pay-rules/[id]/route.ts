import { requireOrgAdmin } from "@/lib/guards"
import { parseBody, runWrite, forbidden } from "@/lib/api"
import { orgHasCapability } from "@/lib/page-guards"
import { payRuleSchema } from "@/lib/zod-schemas"
import { updatePayRule, deletePayRule, type PayRuleInput } from "@/lib/data/commission"

const CAP = "workforce.commissionPay"

function toInput(d: ReturnType<typeof payRuleSchema.parse>): PayRuleInput {
  return {
    userId: d.userId ?? null, role: d.role ?? null, basis: d.basis, splitMode: d.splitMode,
    soloValue: d.soloValue ?? null, pairValue: d.pairValue ?? null, crewValue: d.crewValue ?? null,
    customerId: d.customerId ?? null, serviceLocationId: d.serviceLocationId ?? null, servicePlanId: d.servicePlanId ?? null,
    effectiveFrom: d.effectiveFrom ?? null,
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireOrgAdmin(); if (!g.ok) return g.response
  if (!(await orgHasCapability(g.orgId, CAP))) return forbidden(`Missing capability: ${CAP}`)
  const { id } = await params
  const body = await parseBody(payRuleSchema, request); if (!body.ok) return body.response
  return runWrite(() => updatePayRule(g.orgId, id, toInput(body.data)))
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireOrgAdmin(); if (!g.ok) return g.response
  if (!(await orgHasCapability(g.orgId, CAP))) return forbidden(`Missing capability: ${CAP}`)
  const { id } = await params
  return runWrite(() => deletePayRule(g.orgId, id))
}

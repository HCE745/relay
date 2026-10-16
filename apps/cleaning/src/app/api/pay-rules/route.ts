import { requireOrgAdmin } from "@/lib/guards"
import { ok, parseBody, runWrite, forbidden } from "@/lib/api"
import { orgHasCapability } from "@/lib/page-guards"
import { payRuleSchema } from "@/lib/zod-schemas"
import { listPayRules, createPayRule, type PayRuleInput } from "@/lib/data/commission"

const CAP = "workforce.commissionPay"

// Pay rules are a pay-policy setting: OWNER/ADMIN only, capability-gated.
function toInput(d: ReturnType<typeof payRuleSchema.parse>): PayRuleInput {
  return {
    userId: d.userId ?? null, role: d.role ?? null, basis: d.basis, splitMode: d.splitMode,
    soloValue: d.soloValue ?? null, pairValue: d.pairValue ?? null, crewValue: d.crewValue ?? null,
    customerId: d.customerId ?? null, serviceLocationId: d.serviceLocationId ?? null, servicePlanId: d.servicePlanId ?? null,
    effectiveFrom: d.effectiveFrom ?? null,
  }
}

export async function GET() {
  const g = await requireOrgAdmin(); if (!g.ok) return g.response
  if (!(await orgHasCapability(g.orgId, CAP))) return forbidden(`Missing capability: ${CAP}`)
  return ok(await listPayRules(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireOrgAdmin(); if (!g.ok) return g.response
  if (!(await orgHasCapability(g.orgId, CAP))) return forbidden(`Missing capability: ${CAP}`)
  const body = await parseBody(payRuleSchema, request); if (!body.ok) return body.response
  return runWrite(() => createPayRule(g.orgId, toInput(body.data)), { created: true })
}

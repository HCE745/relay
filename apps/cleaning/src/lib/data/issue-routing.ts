import { orgDb, systemDb } from "../org-db"
import { assertFound } from "./errors"
import { recordAudit } from "./audit"
import { notifyUserEventSafe } from "../notifications/dispatch"

// Issue routing (Phase 31). Priority-ordered, first-match assignment applied on
// creation from EVERY intake source (field, inspection, portal, and later QR/
// SMS). A rule matches when each set condition equals the issue's fact (a null
// condition matches anything); the first active rule in priority order wins,
// otherwise the org's default assignee. Every decision — matched or fallback —
// is logged on the issue as an AuditEvent "route", so routing is explainable.

export type RoutingFacts = {
  category: string
  severity: string
  source: string
  serviceLocationId?: string | null
}

export type RoutingDecision = {
  assignToId: string | null
  ruleId: string | null
  ruleName: string | null
  reason: "rule" | "default" | "none"
}

type RuleRow = {
  id: string
  name: string
  category: string | null
  severity: string | null
  source: string | null
  serviceLocationId: string | null
  assignToId: string
}

function matches(rule: RuleRow, f: RoutingFacts): boolean {
  if (rule.category && rule.category !== f.category) return false
  if (rule.severity && rule.severity !== f.severity) return false
  if (rule.source && rule.source !== f.source) return false
  if (rule.serviceLocationId && rule.serviceLocationId !== (f.serviceLocationId ?? null)) return false
  return true
}

/**
 * Decide who a new issue routes to — PURE (reads config, writes nothing). Used
 * both by the live creation paths and by the dry-run preview. The chosen
 * assignee is re-checked for being active; an inactive target is treated as no
 * assignment so a stale rule never silently drops an issue onto a disabled user.
 */
export async function routeIssue(orgId: string, facts: RoutingFacts): Promise<RoutingDecision> {
  const db = orgDb(orgId)
  const rules = await db.issueRoutingRule.findMany({
    where: { isActive: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, category: true, severity: true, source: true, serviceLocationId: true, assignToId: true },
  })
  const hit = rules.find((r) => matches(r as RuleRow, facts))
  if (hit) {
    if (await isActiveUser(orgId, hit.assignToId)) {
      return { assignToId: hit.assignToId, ruleId: hit.id, ruleName: hit.name, reason: "rule" }
    }
    // Matched rule points at an inactive user — record the match but don't assign.
    return { assignToId: null, ruleId: hit.id, ruleName: hit.name, reason: "rule" }
  }
  const org = await systemDb.organization.findUnique({ where: { id: orgId }, select: { defaultIssueAssigneeId: true } })
  if (org?.defaultIssueAssigneeId && (await isActiveUser(orgId, org.defaultIssueAssigneeId))) {
    return { assignToId: org.defaultIssueAssigneeId, ruleId: null, ruleName: null, reason: "default" }
  }
  return { assignToId: null, ruleId: null, ruleName: null, reason: "none" }
}

async function isActiveUser(orgId: string, userId: string): Promise<boolean> {
  const u = await orgDb(orgId).user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } })
  return !!u
}

/**
 * Apply routing to a just-created issue: assign the chosen owner (if any) and
 * ALWAYS log the decision. Called by every intake path right after create().
 */
export async function applyRouting(orgId: string, issueId: string, actorId: string | null, facts: RoutingFacts): Promise<RoutingDecision> {
  const decision = await routeIssue(orgId, facts)
  if (decision.assignToId) {
    await orgDb(orgId).issue.updateMany({ where: { id: issueId }, data: { assignedToId: decision.assignToId, escalationLevel: 0 } })
  }
  await recordAudit(orgId, actorId, "Issue", issueId, "route", {
    newValue: decision.assignToId ?? undefined,
    metadata: { ruleId: decision.ruleId, ruleName: decision.ruleName, reason: decision.reason },
  })
  if (decision.assignToId) {
    notifyUserEventSafe(orgId, decision.assignToId, "ISSUE_ASSIGNED", { subject: "An issue was routed to you", body: "An issue was automatically assigned to you by a routing rule. Open it in the app for details and the deadline." })
  }
  return decision
}

// ── Rule management ───────────────────────────────────────────────────────────

const ruleInclude = {
  assignTo: { select: { id: true, name: true, isActive: true } },
  serviceLocation: { select: { id: true, name: true } },
} as const

export function listRoutingRules(orgId: string) {
  return orgDb(orgId).issueRoutingRule.findMany({
    orderBy: [{ isActive: "desc" }, { priority: "asc" }, { createdAt: "asc" }],
    include: ruleInclude,
  })
}

export type RoutingRuleInput = {
  name: string
  priority: number
  isActive: boolean
  category: string | null
  severity: string | null
  source: string | null
  serviceLocationId: string | null
  assignToId: string
}

// Validated form shape (Zod) → data-layer input: optional conditions become
// explicit null ("matches any").
export function toRoutingRuleInput(d: {
  name: string; priority: number; isActive: boolean
  category?: string | null; severity?: string | null; source?: string | null
  serviceLocationId?: string | null; assignToId: string
}): RoutingRuleInput {
  return {
    name: d.name, priority: d.priority, isActive: d.isActive,
    category: d.category ?? null, severity: d.severity ?? null, source: d.source ?? null,
    serviceLocationId: d.serviceLocationId ?? null, assignToId: d.assignToId,
  }
}

async function validateTargets(orgId: string, input: RoutingRuleInput) {
  const db = orgDb(orgId)
  const u = await db.user.findFirst({ where: { id: input.assignToId, isActive: true }, select: { id: true } })
  assertFound(u, "Assignee")
  if (input.serviceLocationId) {
    const s = await db.serviceLocation.findFirst({ where: { id: input.serviceLocationId }, select: { id: true } })
    assertFound(s, "Service location")
  }
}

export async function createRoutingRule(orgId: string, actorId: string, input: RoutingRuleInput) {
  await validateTargets(orgId, input)
  const rule = await orgDb(orgId).issueRoutingRule.create({
    data: {
      organizationId: orgId,
      name: input.name,
      priority: input.priority,
      isActive: input.isActive,
      category: (input.category as never) ?? null,
      severity: (input.severity as never) ?? null,
      source: (input.source as never) ?? null,
      serviceLocationId: input.serviceLocationId,
      assignToId: input.assignToId,
    },
    select: { id: true },
  })
  await recordAudit(orgId, actorId, "IssueRoutingRule", rule.id, "create", { newValue: input.name })
  return rule
}

export async function updateRoutingRule(orgId: string, actorId: string, id: string, input: RoutingRuleInput) {
  const db = orgDb(orgId)
  const existing = await db.issueRoutingRule.findFirst({ where: { id }, select: { id: true } })
  assertFound(existing, "Routing rule")
  await validateTargets(orgId, input)
  await db.issueRoutingRule.updateMany({
    where: { id },
    data: {
      name: input.name,
      priority: input.priority,
      isActive: input.isActive,
      category: (input.category as never) ?? null,
      severity: (input.severity as never) ?? null,
      source: (input.source as never) ?? null,
      serviceLocationId: input.serviceLocationId,
      assignToId: input.assignToId,
    },
  })
  await recordAudit(orgId, actorId, "IssueRoutingRule", id, "update", { newValue: input.name })
  return { id }
}

export async function deleteRoutingRule(orgId: string, actorId: string, id: string) {
  const db = orgDb(orgId)
  const existing = await db.issueRoutingRule.findFirst({ where: { id }, select: { id: true, name: true } })
  assertFound(existing, "Routing rule")
  await db.issueRoutingRule.deleteMany({ where: { id } })
  await recordAudit(orgId, actorId, "IssueRoutingRule", id, "delete", { oldValue: existing!.name })
  return { id }
}

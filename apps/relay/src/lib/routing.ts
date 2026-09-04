import "server-only"
import { prisma } from "./prisma"

export interface IssueContext {
  organizationId: string
  category: string
  priority: string
  locationId?: string | null
  departmentId?: string | null
  assetId?: string | null
}

export interface RoutingResult {
  userId: string | null
  userName: string | null
  ruleName: string | null
  matchedConditions: number
}

/**
 * Evaluate all active routing rules for an org against the issue context.
 *
 * Specificity scoring: each condition that is set AND matched adds 1 point.
 * The rule with the highest score wins. Ties are broken by newest rule first
 * (so recently created, more-specific rules naturally win without manual ordering).
 *
 * Returns null userId when no rule matches or no eligible assignee is found.
 */
export async function autoRouteIssue(ctx: IssueContext): Promise<RoutingResult> {
  // Resolve asset type up-front so rules can match on it
  let assetType: string | null = null
  if (ctx.assetId) {
    const asset = await prisma.asset.findUnique({
      where: { id: ctx.assetId },
      select: { type: true },
    })
    assetType = asset?.type ?? null
  }

  const rules = await prisma.routingRule.findMany({
    where: { organizationId: ctx.organizationId, isActive: true },
    orderBy: { createdAt: "desc" }, // newest first for tie-breaking
    include: {
      assignToUser: { select: { id: true, name: true, isActive: true } },
    },
  })

  let bestScore = -1
  let bestRule: (typeof rules)[number] | null = null

  for (const rule of rules) {
    // A rule with NO conditions set is a catch-all (score 0).
    // A condition set to null means "match anything" — it contributes 0 to score.
    // A condition set to a value must match — contributes 1 to score if it does,
    // or disqualifies the rule entirely if it doesn't.

    let score = 0
    let disqualified = false

    const checks: Array<[string | null, string | null]> = [
      [rule.condCategory, ctx.category],
      [rule.condPriority, ctx.priority],
      [rule.condLocationId, ctx.locationId ?? null],
      [rule.condDeptId, ctx.departmentId ?? null],
      [rule.condAssetType, assetType],
    ]

    for (const [ruleVal, issueVal] of checks) {
      if (ruleVal === null) continue        // wildcard — skip, no score
      if (ruleVal !== issueVal) { disqualified = true; break }
      score++
    }

    if (disqualified) continue
    if (score > bestScore) {
      bestScore = score
      bestRule = rule
    }
  }

  if (!bestRule) return { userId: null, userName: null, ruleName: null, matchedConditions: 0 }

  // ── Resolve the target user ───────────────────────────────────────────────

  if (bestRule.assignToUserId) {
    const u = bestRule.assignToUser
    if (u?.isActive) {
      return { userId: u.id, userName: u.name, ruleName: bestRule.name, matchedConditions: bestScore }
    }
  }

  if (bestRule.assignToRole) {
    // 1st preference: user with role in the same location
    // 2nd preference: user with role in the same department
    // 3rd preference: any user with role in the org
    const candidates = await Promise.all([
      ctx.locationId
        ? prisma.user.findFirst({
            where: { organizationId: ctx.organizationId, role: bestRule.assignToRole, isActive: true, locationId: ctx.locationId },
            orderBy: { name: "asc" },
          })
        : Promise.resolve(null),
      ctx.departmentId
        ? prisma.user.findFirst({
            where: { organizationId: ctx.organizationId, role: bestRule.assignToRole, isActive: true, departmentId: ctx.departmentId },
            orderBy: { name: "asc" },
          })
        : Promise.resolve(null),
      prisma.user.findFirst({
        where: { organizationId: ctx.organizationId, role: bestRule.assignToRole, isActive: true },
        orderBy: { name: "asc" },
      }),
    ])

    const resolved = candidates[0] ?? candidates[1] ?? candidates[2]
    if (resolved) {
      return { userId: resolved.id, userName: resolved.name, ruleName: bestRule.name, matchedConditions: bestScore }
    }
  }

  // Rule matched but its target is inactive / not found
  return { userId: null, userName: null, ruleName: bestRule.name, matchedConditions: bestScore }
}

/**
 * Preview routing for a given context without creating an issue.
 * Used by the issue form to show "will be routed to X" before submission.
 */
export async function previewRouting(ctx: IssueContext): Promise<RoutingResult> {
  return autoRouteIssue(ctx)
}

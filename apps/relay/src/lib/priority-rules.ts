export interface PriorityRule {
  id: string
  name: string
  enabled: boolean
  conditions: {
    category?: string[]
    locationIds?: string[]
    departmentIds?: string[]
    titleKeywords?: string[]
  }
  setMinimumPriority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
}

export function parsePriorityRules(raw: unknown): PriorityRule[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((r): r is PriorityRule =>
    r && typeof r === "object" &&
    typeof r.id === "string" &&
    typeof r.setMinimumPriority === "string"
  )
}

const PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

function priorityRank(p: string): number {
  return PRIORITY_ORDER.indexOf(p)
}

interface IssueInput {
  category: string
  locationId: string | null
  departmentId: string | null
  title: string
}

export interface PriorityRuleResult {
  priority: string
  source: "AI" | "RULE" | "MANUAL"
  ruleName: string | null
}

export function applyPriorityRules(
  currentPriority: string,
  currentSource: "AI" | "MANUAL",
  issue: IssueInput,
  rules: PriorityRule[],
): PriorityRuleResult {
  let result = currentPriority
  let matchedRuleName: string | null = null

  for (const rule of rules) {
    if (!rule.enabled) continue
    const c = rule.conditions
    if (c.category?.length && !c.category.includes(issue.category)) continue
    if (c.locationIds?.length && (!issue.locationId || !c.locationIds.includes(issue.locationId))) continue
    if (c.departmentIds?.length && (!issue.departmentId || !c.departmentIds.includes(issue.departmentId))) continue
    if (c.titleKeywords?.length) {
      const lc = issue.title.toLowerCase()
      if (!c.titleKeywords.some(k => lc.includes(k.toLowerCase()))) continue
    }
    // Rule matched — apply minimum priority (never lower)
    if (priorityRank(rule.setMinimumPriority) > priorityRank(result)) {
      result = rule.setMinimumPriority
      matchedRuleName = rule.name
    }
  }

  return {
    priority: result,
    source: matchedRuleName ? "RULE" : currentSource,
    ruleName: matchedRuleName,
  }
}

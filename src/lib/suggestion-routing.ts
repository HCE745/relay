import "server-only"
import { prisma } from "./prisma"
export type { SuggestionCategory } from "./suggestion-constants"
export { SUGGESTION_CATEGORY_LABEL } from "./suggestion-constants"
import type { SuggestionCategory } from "./suggestion-constants"

// Map suggestion category → preferred roles to route to (in order of preference)
const CATEGORY_ROLES: Record<SuggestionCategory, string[]> = {
  SAFETY: ["SUPERVISOR", "MANAGER", "ADMIN"],
  MAINTENANCE: ["SUPERVISOR", "MANAGER", "ADMIN"],
  HR: ["HR", "ADMIN"],
  PROCESS: ["MANAGER", "ADMIN"],
  FACILITY: ["MANAGER", "SUPERVISOR", "ADMIN"],
  SUPPLY: ["MANAGER", "ADMIN"],
  CUSTOMER: ["MANAGER", "ADMIN"],
  GENERAL: ["MANAGER", "ADMIN"],
}

// Keyword sets for each category
const PATTERNS: Array<{ category: SuggestionCategory; regex: RegExp }> = [
  { category: "SAFETY", regex: /safety|hazard|danger|dangerous|accident|injury|unsafe|risk|emergency|fire|chemical|spill|ppe|protective/i },
  { category: "MAINTENANCE", regex: /maintenance|broken|repair|fix|machine|equipment|hvac|leak|malfunction|worn|damaged|replace|tool|vehicle|forklift/i },
  { category: "HR", regex: /\bhr\b|payroll|benefits|vacation|leave|policy|hire|firing|fired|performance|salary|wage|training|onboarding|culture|morale|harassment/i },
  { category: "FACILITY", regex: /facility|building|office|room|space|restroom|bathroom|parking|lighting|temperature|heat|cold|noise|clean|janitorial|door|window/i },
  { category: "SUPPLY", regex: /supply|supplies|inventory|stock|order|shortage|material|parts|consumable|restock/i },
  { category: "CUSTOMER", regex: /customer|client|complaint|service|quality|satisfaction|review|feedback|return|product/i },
  { category: "PROCESS", regex: /process|efficiency|workflow|streamline|improve|procedure|system|waste|bottleneck|automate|communication|meeting|reporting/i },
]

export function detectSuggestionCategory(content: string): SuggestionCategory {
  for (const { category, regex } of PATTERNS) {
    if (regex.test(content)) return category
  }
  return "GENERAL"
}

export async function routeSuggestion(
  organizationId: string,
  category: SuggestionCategory,
  excludeUserId: string
): Promise<{ id: string; name: string } | null> {
  const roles = CATEGORY_ROLES[category]
  for (const role of roles) {
    const user = await prisma.user.findFirst({
      where: {
        organizationId,
        role,
        isActive: true,
        id: { not: excludeUserId },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })
    if (user) return user
  }
  return null
}

// Map suggestion category to nearest issue category for work order conversion
export const SUGGESTION_TO_ISSUE_CATEGORY: Record<SuggestionCategory, string> = {
  SAFETY: "SAFETY",
  MAINTENANCE: "MAINTENANCE",
  FACILITY: "FACILITY",
  SUPPLY: "SUPPLY_SHORTAGE",
  HR: "EMPLOYEE",
  PROCESS: "GENERAL",
  CUSTOMER: "CUSTOMER_COMPLAINT",
  GENERAL: "GENERAL",
}

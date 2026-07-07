import { prisma } from "./prisma"

const INDUSTRY_MAP: Record<string, string> = {
  manufacturing:   "manufacturing",
  production:      "manufacturing",
  "food & beverage": "manufacturing",
  healthcare:      "healthcare",
  medical:         "healthcare",
  hospital:        "healthcare",
  pharmaceutical:  "healthcare",
  retail:          "retail",
  "e-commerce":    "retail",
  hospitality:     "hospitality",
  hotel:           "hospitality",
  restaurant:      "hospitality",
  education:       "education",
  school:          "education",
  university:      "education",
  construction:    "construction",
  contracting:     "construction",
  logistics:       "logistics",
  transportation:  "logistics",
  warehouse:       "logistics",
  technology:      "technology",
  software:        "technology",
  finance:         "finance",
  banking:         "finance",
  insurance:       "finance",
  "real estate":   "real_estate",
  property:        "real_estate",
  government:      "government",
  nonprofit:       "nonprofit",
}

export function bucketIndustry(raw: string | null | undefined): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  for (const [key, bucket] of Object.entries(INDUSTRY_MAP)) {
    if (lower.includes(key)) return bucket
  }
  return "other"
}

interface PatternInput {
  issueId:       string
  category:      string
  priority:      string
  orgIndustry:   string | null | undefined
  assetType?:    string | null
  recordType?:   "issue" | "suggestion"
}

export async function writeIssuePattern(input: PatternInput) {
  await prisma.issuePattern.upsert({
    where:  { sourceIssueId: input.issueId },
    update: {},
    create: {
      sourceIssueId:   input.issueId,
      recordType:      input.recordType ?? "issue",
      category:        input.category,
      priority:        input.priority,
      industryBucket:  bucketIndustry(input.orgIndustry),
      assetTypeBucket: input.assetType ?? null,
    },
  })
}

export async function resolveIssuePattern(issueId: string, resolvedAt: Date, wasEscalated: boolean, createdAt: Date) {
  const daysDiff = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  await prisma.issuePattern.updateMany({
    where: { sourceIssueId: issueId, resolvedAt: null },
    data: {
      resolvedAt,
      wasEscalated,
      resolvedInDays: parseFloat(daysDiff.toFixed(2)),
    },
  })
}

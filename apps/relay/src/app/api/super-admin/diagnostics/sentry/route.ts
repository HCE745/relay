import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"

const SENTRY_BASE = "https://sentry.io/api/0"

interface SentryIssueRaw {
  id: string
  title: string
  culprit: string
  shortId: string
  count: string
  userCount: number
  firstSeen: string
  lastSeen: string
  isResolved: boolean
  permalink: string
  level: string
  status: string
}

interface SentryTagValue {
  value: string
  count: number
  name: string | null
  lastSeen: string
  firstSeen: string
}

async function sentryGet(path: string, params: Record<string, string> = {}): Promise<unknown[] | null> {
  const token = process.env.SENTRY_AUTH_TOKEN
  const org   = process.env.SENTRY_ORG
  const proj  = process.env.SENTRY_PROJECT
  if (!token || !org || !proj) return null

  const url = new URL(`${SENTRY_BASE}/projects/${org}/${proj}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json() as Promise<unknown[]>
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = process.env.SENTRY_AUTH_TOKEN
  if (!token) {
    return NextResponse.json({
      configured: false,
      errors24h: 0,
      errors7d: 0,
      activeIssues: 0,
      issues: [],
      orgBreakdown: [],
    })
  }

  const orgId = req.nextUrl.searchParams.get("orgId") // null = platform-wide
  const orgFilter = orgId ? `organization_id:${orgId} ` : ""

  const [issues24h, issues7d, issuesAll, tagValues] = await Promise.all([
    sentryGet("issues/", {
      query: `${orgFilter}is:unresolved`,
      statsPeriod: "24h",
      limit: "100",
    }),
    sentryGet("issues/", {
      query: `${orgFilter}is:unresolved`,
      statsPeriod: "7d",
      limit: "100",
    }),
    sentryGet("issues/", {
      query: `${orgFilter}is:unresolved`,
      limit: "25",
      sort: "date",
    }),
    // For platform-wide view: fetch org tag breakdown
    !orgId
      ? sentryGet("tags/organization_id/values/", { statsPeriod: "7d", limit: "100" })
      : Promise.resolve(null),
  ])

  const mapped = ((issuesAll ?? []) as SentryIssueRaw[]).map((issue) => ({
    id:         issue.id,
    title:      issue.title,
    culprit:    issue.culprit ?? "",
    shortId:    issue.shortId,
    count:      parseInt(issue.count, 10) || 0,
    userCount:  issue.userCount ?? 0,
    firstSeen:  issue.firstSeen,
    lastSeen:   issue.lastSeen,
    isResolved: issue.isResolved,
    permalink:  issue.permalink,
    level:      issue.level ?? "error",
  }))

  const orgBreakdown = tagValues
    ? ((tagValues as SentryTagValue[])
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map((t) => ({
          orgId:     t.value,
          count:     t.count,
          lastSeen:  t.lastSeen,
          firstSeen: t.firstSeen,
        })))
    : []

  return NextResponse.json({
    configured:   true,
    errors24h:    (issues24h ?? []).length,
    errors7d:     (issues7d ?? []).length,
    activeIssues: (issuesAll ?? []).length,
    issues:       mapped,
    orgBreakdown,
  })
}

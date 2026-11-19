import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getResearchIdentity } from "@/lib/research-list-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// ── GET /api/super-admin/crm/prospects/discover/lists ─────────────────────────
// Returns only the lists the caller personally owns.
// isShared is a metadata flag and does NOT grant visibility to other users.
export async function GET() {
  const identity = await getResearchIdentity()
  if (!identity) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lists = await prisma.prospectResearchList.findMany({
    where: identity.superAdminId
      ? { isExplicitlySaved: true, superAdminId: identity.superAdminId }
      : { isExplicitlySaved: true, salesUserId:  identity.salesUserId  },
    include: { _count: { select: { results: true } } },
    // Active lists first (by createdAt desc), then completed
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  })

  // Add per-list done count without loading all result rows
  const listIds = lists.map(l => l.id)
  const doneCounts = listIds.length > 0
    ? await prisma.prospectResearchResult.groupBy({
        by: ["listId"],
        where: { listId: { in: listIds }, isDone: true },
        _count: { id: true },
      })
    : []
  const doneByListId = Object.fromEntries(doneCounts.map(d => [d.listId, d._count.id]))

  const withOwnership = lists.map(list => ({
    ...list,
    ownedByMe:
      (!!identity.superAdminId && list.superAdminId === identity.superAdminId) ||
      (!!identity.salesUserId  && list.salesUserId  === identity.salesUserId),
    doneCount: doneByListId[list.id] ?? 0,
  }))

  return NextResponse.json(withOwnership)
}

// ── POST /api/super-admin/crm/prospects/discover/lists ────────────────────────
// Creates a new research list and optionally bulk-inserts results.
// Body: { name, description?, isShared?, searchCountry?, searchState?,
//         searchIndustry?, searchEmpMin?, searchEmpMax?, searchKeywords?,
//         searchContext?, results?: DiscoveredCompany[] }
export async function POST(req: NextRequest) {
  const identity = await getResearchIdentity()
  if (!identity) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const {
    name, description, isShared,
    searchCountry, searchState, searchIndustry,
    searchEmpMin, searchEmpMax, searchKeywords, searchContext,
    results = [],
  } = body

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const list = await prisma.prospectResearchList.create({
    data: {
      name: name.trim(),
      description: description ?? null,
      // Only a non-impersonating super-admin may create shared lists.
      isShared: identity.superAdminId ? isShared === true : false,
      salesUserId:  identity.salesUserId  ?? null,
      superAdminId: identity.superAdminId ?? null,
      searchCountry:  searchCountry  ?? null,
      searchState:    searchState    ?? null,
      searchIndustry: searchIndustry ?? null,
      searchEmpMin:   searchEmpMin   ?? null,
      searchEmpMax:   searchEmpMax   ?? null,
      searchKeywords: searchKeywords ?? null,
      searchContext:  searchContext  ?? null,
      results: results.length > 0 ? {
        createMany: {
          data: results.map((r: Record<string, unknown>) => buildResultData(r, searchCountry, searchState)),
          skipDuplicates: true,
        },
      } : undefined,
    },
    include: { _count: { select: { results: true } } },
  })

  return NextResponse.json(list, { status: 201 })
}

// Normalize a domain for dedup (strips www., lowercases, strips trailing slash)
function normalizeDomain(website: string | null | undefined): string | null {
  if (!website) return null
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`)
    return url.hostname.replace(/^www\./, "").toLowerCase().slice(0, 253) || null
  } catch {
    return null
  }
}

function buildResultData(
  r: Record<string, unknown>,
  requestedCountry?: string,
  requestedState?: string,
) {
  const verifiedState  = (r.state  as string | undefined) ?? null
  // Case-insensitive comparison — the discover route normalises state to 2-letter codes,
  // but handle full names gracefully in case results come from another path.
  const locationVerified = !!(requestedState && verifiedState &&
    verifiedState.trim().toLowerCase() === requestedState.trim().toLowerCase())

  return {
    companyName:         String(r.companyName ?? ""),
    website:             (r.website as string | null) ?? null,
    normalizedDomain:    normalizeDomain(r.website as string | null),
    requestedCountry:    requestedCountry ?? null,
    requestedState:      requestedState   ?? null,
    verifiedCity:        (r.city    as string | null) ?? null,
    verifiedState,
    verifiedCountry:     (r.country as string | null) ?? null,
    locationVerified,
    industry:            (r.industry           as string | null) ?? null,
    estimatedEmployees:  (r.estimatedEmployees  as string | null) ?? (r.employeeCount as string | null) ?? null,
    summary:             (r.summary            as string | null) ?? null,
    fitScore:            typeof r.fitScore === "number" ? r.fitScore : null,
    painPoints:          Array.isArray(r.painPoints)      ? r.painPoints      : [],
    relayFitReasons:     Array.isArray(r.relayFitReasons) ? r.relayFitReasons : [],
    outreachAngle:       (r.suggestedOutreachAngle as string | null) ?? null,
    sourceCitations:     Array.isArray(r.sourceCitations) ? (r.sourceCitations as string[]) : [],
    employeeCountSource: typeof r.employeeCountTier === "string" ? (r.employeeCountTier as string) : null,
    source:              "ai_discover",
  }
}

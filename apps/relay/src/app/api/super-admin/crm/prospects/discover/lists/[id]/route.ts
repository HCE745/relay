import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function canAccess(
  list: { salesUserId: string | null; superAdminId: string | null; isShared: boolean },
  session: { salesUserId?: string; superAdminId?: string },
): boolean {
  if (list.isShared) return true
  if (session.superAdminId && list.superAdminId === session.superAdminId) return true
  if (session.salesUserId  && list.salesUserId  === session.salesUserId)  return true
  return false
}

function isOwner(
  list: { salesUserId: string | null; superAdminId: string | null },
  session: { salesUserId?: string; superAdminId?: string },
): boolean {
  if (session.superAdminId && list.superAdminId === session.superAdminId) return true
  if (session.salesUserId  && list.salesUserId  === session.salesUserId)  return true
  return false
}

type RouteCtx = { params: Promise<{ id: string }> }

// ── GET /api/super-admin/crm/prospects/discover/lists/[id] ───────────────────
// Returns a list with all its results (accessible to owner or if shared).
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdminId && !session?.salesUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const list = await prisma.prospectResearchList.findUnique({
    where: { id },
    include: { results: { orderBy: [{ fitScore: "desc" }, { companyName: "asc" }] } },
  })

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canAccess(list, session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(list)
}

// ── PATCH /api/super-admin/crm/prospects/discover/lists/[id] ─────────────────
// Updates the list's name and/or description. Owner only.
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdminId && !session?.salesUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const list = await prisma.prospectResearchList.findUnique({
    where: { id },
    select: { salesUserId: true, superAdminId: true, isShared: true },
  })

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!isOwner(list, session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json() as { name?: string; description?: string }
  const data: { name?: string; description?: string | null } = {}
  if (typeof body.name === "string") {
    const trimmed = body.name.trim()
    if (!trimmed) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 })
    data.name = trimmed
  }
  if ("description" in body) data.description = body.description ?? null

  const updated = await prisma.prospectResearchList.update({
    where: { id },
    data,
    include: { _count: { select: { results: true } } },
  })

  return NextResponse.json(updated)
}

// ── DELETE /api/super-admin/crm/prospects/discover/lists/[id] ────────────────
// Deletes a list (and cascades to its results). Owner only.
// Results with prospectId set are preserved via ON DELETE SET NULL on that FK.
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdminId && !session?.salesUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const list = await prisma.prospectResearchList.findUnique({
    where: { id },
    select: { salesUserId: true, superAdminId: true, isShared: true },
  })

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!isOwner(list, session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.prospectResearchList.delete({ where: { id } })

  return NextResponse.json({ deleted: true })
}

// ── POST /api/super-admin/crm/prospects/discover/lists/[id] ──────────────────
// Appends additional research results to an existing list (Find More).
// Body: { results: DiscoveredCompany[] }
// Skips duplicates by normalizedDomain (same domain already in list = ignored).
// Returns { appended: number, skipped: number, updatedList }.
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdminId && !session?.salesUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const list = await prisma.prospectResearchList.findUnique({
    where:   { id },
    include: { _count: { select: { results: true } }, results: { select: { normalizedDomain: true } } },
  })
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const hasAccess =
    list.isShared ||
    (session.superAdminId && list.superAdminId === session.superAdminId) ||
    (session.salesUserId  && list.salesUserId  === session.salesUserId)
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { results = [] } = await req.json() as { results: Record<string, unknown>[] }
  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: "results must be a non-empty array" }, { status: 400 })
  }

  // Build set of existing domains already in this list
  const existingDomains = new Set(
    list.results.map(r => r.normalizedDomain).filter(Boolean) as string[]
  )

  function normalizeDomain(website: string | null | undefined): string | null {
    if (!website) return null
    try {
      const url = new URL((website as string).startsWith("http") ? website as string : `https://${website}`)
      return url.hostname.replace(/^www\./, "").toLowerCase().slice(0, 253) || null
    } catch { return null }
  }

  let appended = 0
  let skipped  = 0

  for (const r of results) {
    const nd = normalizeDomain(r.website as string | null)
    if (nd && existingDomains.has(nd)) { skipped++; continue }

    const verifiedState = (r.state as string | undefined) ?? null
    const locationVerified = !!(list.searchState && verifiedState &&
      verifiedState.toLowerCase() === list.searchState.toLowerCase())

    try {
      await prisma.prospectResearchResult.create({
        data: {
          listId:            id,
          companyName:       String(r.companyName ?? ""),
          website:           (r.website as string | null) ?? null,
          normalizedDomain:  nd,
          requestedCountry:  list.searchCountry ?? null,
          requestedState:    list.searchState   ?? null,
          verifiedCity:      (r.city    as string | null) ?? null,
          verifiedState,
          verifiedCountry:   (r.country as string | null) ?? null,
          locationVerified,
          industry:           (r.industry           as string | null) ?? null,
          estimatedEmployees: (r.estimatedEmployees  as string | null) ?? null,
          summary:            (r.summary            as string | null) ?? null,
          fitScore:           typeof r.fitScore === "number" ? r.fitScore : null,
          painPoints:         Array.isArray(r.painPoints)      ? r.painPoints      : [],
          relayFitReasons:    Array.isArray(r.relayFitReasons) ? r.relayFitReasons : [],
          outreachAngle:      (r.suggestedOutreachAngle as string | null) ?? null,
          source:             "ai_discover",
        },
      })
      if (nd) existingDomains.add(nd)
      appended++
    } catch { skipped++ }
  }

  const updatedList = await prisma.prospectResearchList.findUnique({
    where:   { id },
    include: { _count: { select: { results: true } } },
  })

  return NextResponse.json({ appended, skipped, updatedList })
}

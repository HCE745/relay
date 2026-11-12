import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// ── POST /api/super-admin/crm/prospects/discover/lists/[id]/promote ──────────
// Promotes one or more research results to full CRM Prospects.
// Body: { resultIds: string[] }
//
// - Skips results already promoted (prospectId already set).
// - Creates a Prospect record for each, then links the result via prospectId.
// - Caller must own or have access to the list.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const hasAccess =
    list.isShared ||
    (session.superAdminId && list.superAdminId === session.superAdminId) ||
    (session.salesUserId  && list.salesUserId  === session.salesUserId)
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { resultIds } = await req.json() as { resultIds: string[] }
  if (!Array.isArray(resultIds) || resultIds.length === 0) {
    return NextResponse.json({ error: "resultIds must be a non-empty array" }, { status: 400 })
  }

  const results = await prisma.prospectResearchResult.findMany({
    where: { id: { in: resultIds }, listId: id, prospectId: null },
  })

  const promoted: { resultId: string; prospectId: string }[] = []

  for (const result of results) {
    // Check if a Prospect with the same company name already exists
    const existing = await prisma.prospect.findFirst({
      where: { companyName: { equals: result.companyName, mode: "insensitive" } },
      select: { id: true },
    })

    const prospectId = existing
      ? existing.id
      : (await prisma.prospect.create({
          data: {
            companyName:            result.companyName,
            website:                result.website            ?? null,
            industry:               result.industry           ?? null,
            headquartersCity:       result.verifiedCity       ?? null,
            headquartersState:      result.verifiedState      ?? null,
            source:                 "ai_research",
            researchSummary:        result.summary            ?? null,
            operationalPainPoints:  result.painPoints.join(" • ") || null,
            relayFitReasons:        result.relayFitReasons.join(" • ") || null,
            suggestedOutreachAngle: result.outreachAngle      ?? null,
            aiFitScore:             result.fitScore           ?? null,
            currentCrmStatus:       "researched",
          },
        })).id

    await prisma.prospectResearchResult.update({
      where: { id: result.id },
      data: { prospectId, promotedAt: new Date() },
    })

    promoted.push({ resultId: result.id, prospectId })
  }

  return NextResponse.json({ promoted })
}

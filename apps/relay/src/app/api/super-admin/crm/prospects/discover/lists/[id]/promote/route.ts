import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"
import { findDuplicateProspect } from "@/lib/prospect-utils"
import { listIsOwner } from "@/lib/research-list-auth"

export const dynamic = "force-dynamic"

// ── POST /api/super-admin/crm/prospects/discover/lists/[id]/promote ──────────
// Promotes one or more research results to full CRM Prospects.
// Body: { resultIds: string[] }
//
// Ownership rules:
//  - Rep promotion assigns the Prospect to that rep.
//  - Manager promotion assigns the Prospect to that manager.
//  - SA promotion creates an unassigned Prospect (SA reassigns via the CRM panel).
//  - Reps and managers cannot claim a Prospect already owned by a different rep;
//    they receive a 409 and must request reassignment through SA.
//
// Deduplication: domain match first (reliable), then normalized name match —
// matching the behaviour of the manual save path (POST /api/sales/prospects).
//
// Race condition note: the check-then-create pattern here is not atomic.
// Two concurrent promotions of the same company that both see no existing Prospect
// can both create one. Without a DB unique constraint on (company name / domain)
// this window cannot be closed in application code. See audit report §5 for the
// required migration. The practical risk is low (two reps promoting the same
// company at the same instant) but it exists and should be tracked.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // getSalesSession provides user metadata (name, role) needed for Prospect creation.
  // getSession provides the raw superAdminId needed for list ownership checks.
  const [info, session] = await Promise.all([getSalesSession(), getSession()])
  if (!info || !session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const list = await prisma.prospectResearchList.findUnique({
    where: { id },
    select: { salesUserId: true, superAdminId: true, isShared: true },
  })
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Only the list owner may promote results from it.
  if (!listIsOwner(list, session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { resultIds } = await req.json() as { resultIds: string[] }
  if (!Array.isArray(resultIds) || resultIds.length === 0) {
    return NextResponse.json({ error: "resultIds must be a non-empty array" }, { status: 400 })
  }

  const results = await prisma.prospectResearchResult.findMany({
    where: { id: { in: resultIds }, listId: id, prospectId: null },
  })

  const promoted: { resultId: string; prospectId: string }[] = []

  for (const result of results) {
    // SA creates unassigned Prospects; reps and managers assign to themselves.
    const newOwnerId   = info.isSuperAdmin ? null : info.salesUserId
    const newOwnerName = info.isSuperAdmin ? null : info.salesUserName

    // Domain + name dedup — same strategy as the manual save path.
    const duplicate = await findDuplicateProspect({
      companyName: result.companyName,
      website:     result.website ?? null,
    })

    if (duplicate) {
      // Conflict: a rep or manager cannot claim a company assigned to someone else.
      if (
        !info.isSuperAdmin &&
        duplicate.assignedToId &&
        duplicate.assignedToId !== info.salesUserId
      ) {
        return NextResponse.json({
          error:               "conflict",
          message:             `${result.companyName} is already assigned to another salesperson. Contact your manager to request reassignment.`,
          conflictingProspectId: duplicate.id,
        }, { status: 409 })
      }

      // Link the result to the existing Prospect.
      await prisma.prospectResearchResult.update({
        where: { id: result.id },
        data:  { prospectId: duplicate.id, promotedAt: new Date() },
      })

      // If the existing Prospect is unowned and the caller is a rep/manager, claim it.
      if (!info.isSuperAdmin && !duplicate.assignedToId && newOwnerId) {
        await prisma.prospect.update({
          where: { id: duplicate.id },
          data:  { assignedToId: newOwnerId, assignedToName: newOwnerName },
        })
        await prisma.accountAssignmentHistory.create({
          data: {
            recordType:      "prospect",
            recordId:        duplicate.id,
            previousOwnerId: null,
            newOwnerId:      newOwnerId,
            changedById:     info.salesUserId,
            changedByType:   "SALES_USER",
            reason:          "promoted_from_research",
          },
        })
      }

      promoted.push({ resultId: result.id, prospectId: duplicate.id })
      continue
    }

    // No existing match — create a new Prospect with the caller as owner.
    const prospect = await prisma.prospect.create({
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
        assignedToId:           newOwnerId,
        assignedToName:         newOwnerName,
      },
    })

    if (newOwnerId) {
      await prisma.accountAssignmentHistory.create({
        data: {
          recordType:      "prospect",
          recordId:        prospect.id,
          previousOwnerId: null,
          newOwnerId:      newOwnerId,
          changedById:     info.salesUserId,
          changedByType:   "SALES_USER",
          reason:          "promoted_from_research",
        },
      })
    }

    await prisma.prospectResearchResult.update({
      where: { id: result.id },
      data:  { prospectId: prospect.id, promotedAt: new Date() },
    })

    promoted.push({ resultId: result.id, prospectId: prospect.id })
  }

  return NextResponse.json({ promoted })
}

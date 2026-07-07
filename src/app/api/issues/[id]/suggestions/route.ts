import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { generateIssueSuggestions } from "@/lib/ai-suggestions"
import { checkLimit, limiters } from "@/lib/ratelimit"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const issue = await prisma.issue.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { submitterSuggestion: true, assigneeSuggestion: true },
  })
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    submitterSuggestion: issue.submitterSuggestion,
    assigneeSuggestion: issue.assigneeSuggestion,
  })
}

// Trigger on-demand generation for issues that have no suggestions yet
// (handles seeded/pre-existing issues that bypassed the creation API)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const issue = await prisma.issue.findFirst({
    where: { id, organizationId: session.organizationId },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      priority: true,
      organizationId: true,
      submitterSuggestion: true,
      assigneeSuggestion: true,
      asset:      { select: { type: true } },
      location:   { select: { name: true } },
      department: { select: { name: true } },
    },
  })
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Already generated — nothing to do
  if (issue.submitterSuggestion || issue.assigneeSuggestion) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { industry: true, aiSuggestionsAvailable: true, aiSuggestionsPolicy: true },
  })

  if (!org?.aiSuggestionsAvailable || org.aiSuggestionsPolicy === "off_all") {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const aiBlocked = await checkLimit(limiters.aiOrg, `ai-org:${session.organizationId}`)
  if (aiBlocked) return NextResponse.json({ ok: true, skipped: true })

  // Fire-and-forget — client will poll for results
  generateIssueSuggestions(
    {
      id:             issue.id,
      title:          issue.title,
      description:    issue.description,
      category:       issue.category,
      priority:       issue.priority,
      organizationId: issue.organizationId,
      assetType:      issue.asset?.type ?? null,
      locationName:   issue.location?.name ?? null,
      departmentName: issue.department?.name ?? null,
    },
    org.industry ?? null,
  ).then(({ submitterSuggestion, assigneeSuggestion }) => {
    if (submitterSuggestion || assigneeSuggestion) {
      return prisma.issue.update({
        where: { id: issue.id },
        data: {
          ...(submitterSuggestion ? { submitterSuggestion } : {}),
          ...(assigneeSuggestion  ? { assigneeSuggestion  } : {}),
        },
      })
    }
  }).catch(err => {
    console.error("[AI Suggestion] On-demand generation failed for issue", issue.id, err)
  })

  return NextResponse.json({ ok: true }, { status: 202 })
}

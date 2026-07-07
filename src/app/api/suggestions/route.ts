import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { detectSuggestionCategory, routeSuggestion } from "@/lib/suggestion-routing"
import { writeIssuePattern } from "@/lib/patterns"
import { checkLimit, limiters } from "@/lib/ratelimit"
import { generateSuggestionApproaches } from "@/lib/ai-suggestions"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isAdmin = session.role === "ADMIN" || session.role === "HR"

  if (isAdmin) {
    const suggestions = await prisma.suggestion.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        submittedBy: { select: { id: true, name: true } },
        routedToUser: { select: { id: true, name: true } },
        convertedToIssue: { select: { id: true, title: true } },
        attachments: { orderBy: { createdAt: "asc" } },
      },
    })
    return NextResponse.json(suggestions)
  }

  const suggestions = await prisma.suggestion.findMany({
    where: { organizationId: session.organizationId, routedToUserId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      submittedBy: { select: { id: true, name: true } },
      routedToUser: { select: { id: true, name: true } },
      convertedToIssue: { select: { id: true, title: true } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  })
  return NextResponse.json(suggestions)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const blocked = await checkLimit(
    limiters.suggestions,
    `suggestions:${session.userId}`,
    "Suggestion limit reached. You can submit up to 50 suggestions per hour.",
  )
  if (blocked) return blocked

  const { content, overrideUserId, attachments } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: "Content is required" }, { status: 400 })

  const detectedCategory = detectSuggestionCategory(content)

  let routedToUserId: string | null = overrideUserId || null
  if (!routedToUserId) {
    const routed = await routeSuggestion(session.organizationId, detectedCategory, session.userId)
    routedToUserId = routed?.id ?? null
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { industry: true },
  })

  const suggestion = await prisma.suggestion.create({
    data: {
      organizationId: session.organizationId,
      submittedById: session.userId,
      content: content.trim(),
      detectedCategory,
      routedToUserId,
    },
    include: {
      submittedBy: { select: { id: true, name: true } },
      routedToUser: { select: { id: true, name: true } },
    },
  })

  // ── Attachments ────────────────────────────────────────────────────────────
  const attachmentList = Array.isArray(attachments) ? attachments : []
  if (attachmentList.length > 0) {
    await prisma.attachment.createMany({
      data: attachmentList.map((a: { url: string; filename: string; mimeType: string; size: number }) => ({
        url:          a.url,
        filename:     a.filename,
        mimeType:     a.mimeType,
        size:         a.size,
        suggestionId: suggestion.id,
      })),
    })
  }

  // ── Pattern record (fire-and-forget) ──────────────────────────────────────
  if (detectedCategory) {
    writeIssuePattern({
      issueId:     suggestion.id,
      category:    detectedCategory,
      priority:    "MEDIUM",
      orgIndustry: org?.industry,
      recordType:  "suggestion",
    }).catch(() => {/* non-critical */})
  }

  // ── AI approaches for recipient (fire-and-forget) ─────────────────────────
  if (routedToUserId) {
    generateSuggestionApproaches(
      suggestion.id,
      content.trim(),
      detectedCategory,
      org?.industry ?? null,
    ).catch((err) => {
      console.error("[AI Suggestion] Failed to generate suggestion approaches for", suggestion.id, err)
    })
  }

  return NextResponse.json(suggestion, { status: 201 })
}

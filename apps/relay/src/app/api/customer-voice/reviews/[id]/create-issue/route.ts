import "server-only"
import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const CATEGORY_MAP: Record<string, string> = {
  EQUIPMENT:   "EQUIPMENT",
  SAFETY:      "SAFETY",
  SERVICE:     "GENERAL",
  CLEANLINESS: "CLEANLINESS",
  FACILITY:    "FACILITY",
  PRICING:     "GENERAL",
  STAFF:       "GENERAL",
  OTHER:       "GENERAL",
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const feedback = await prisma.customerFeedback.findUnique({
    where: { id },
    include: { location: true },
  })

  if (!feedback) return NextResponse.json({ error: "Feedback not found" }, { status: 404 })
  if (feedback.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (feedback.status === "ISSUE_CREATED") {
    return NextResponse.json({ error: "Issue already created for this feedback" }, { status: 409 })
  }

  const isCritical = (feedback.rating ?? 5) <= 2 &&
    (feedback.aiCategory === "SAFETY" || feedback.aiCategory === "EQUIPMENT")

  const sourceUrl = (feedback.sourceMetadata as Record<string, string> | null)?.reviewUrl ?? null

  const description = [
    feedback.aiSummary      ? `**AI Summary:** ${feedback.aiSummary}` : null,
    `**Customer Feedback (${feedback.rating ?? "?"} ★):** ${feedback.feedbackText ?? "(no text)"}`,
    feedback.customerName   ? `**From:** ${feedback.customerName}` : null,
    feedback.aiRecommendedAction ? `**Recommended Action:** ${feedback.aiRecommendedAction}` : null,
    sourceUrl               ? `**Source:** ${sourceUrl}` : null,
  ].filter(Boolean).join("\n\n")

  const issue = await prisma.issue.create({
    data: {
      title:          feedback.aiSummary ?? `Customer feedback: ${feedback.rating ?? "?"}★ — ${(feedback.feedbackText ?? "").slice(0, 80)}`,
      description,
      status:         "OPEN",
      priority:       isCritical ? "HIGH" : "MEDIUM",
      category:       CATEGORY_MAP[feedback.aiCategory ?? "OTHER"] ?? "GENERAL",
      organizationId: session.organizationId,
      locationId:     feedback.locationId ?? undefined,
      reportedById:   session.userId,
    },
  })

  await prisma.customerFeedback.update({
    where: { id },
    data:  { status: "ISSUE_CREATED", issueId: issue.id },
  })

  return NextResponse.json({ issueId: issue.id })
}

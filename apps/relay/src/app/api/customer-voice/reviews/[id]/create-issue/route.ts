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
  OTHER:       "GENERAL",
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const review = await prisma.customerReview.findUnique({
    where: { id },
    include: { location: true },
  })

  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 })
  if (review.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (review.status === "ISSUE_CREATED") {
    return NextResponse.json({ error: "Issue already created for this review" }, { status: 409 })
  }

  const isCritical = review.rating <= 2 &&
    (review.aiCategory === "SAFETY" || review.aiCategory === "EQUIPMENT")

  const description = [
    review.aiSummary ? `**AI Summary:** ${review.aiSummary}` : null,
    `**Customer Review (${review.rating} ★):** ${review.reviewText ?? "(no text)"}`,
    review.reviewerName ? `**Reviewer:** ${review.reviewerName}` : null,
    review.recommendedAction ? `**Recommended Action:** ${review.recommendedAction}` : null,
    review.sourceUrl ? `**Source:** ${review.sourceUrl}` : null,
  ].filter(Boolean).join("\n\n")

  const issue = await prisma.issue.create({
    data: {
      title:          review.aiSummary ?? `Customer review: ${review.rating}★ — ${(review.reviewText ?? "").slice(0, 80)}`,
      description,
      status:         "OPEN",
      priority:       isCritical ? "HIGH" : "MEDIUM",
      category:       CATEGORY_MAP[review.aiCategory ?? "OTHER"] ?? "GENERAL",
      organizationId: session.organizationId,
      locationId:     review.locationId ?? undefined,
      reportedById:   session.userId,
    },
  })

  await prisma.customerReview.update({
    where: { id },
    data:  { status: "ISSUE_CREATED", issueId: issue.id },
  })

  return NextResponse.json({ issueId: issue.id })
}

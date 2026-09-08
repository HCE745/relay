import "server-only"
import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status         = searchParams.get("status")         ?? undefined
  const classification = searchParams.get("classification") ?? undefined
  const category       = searchParams.get("category")       ?? undefined
  const source         = searchParams.get("source")         ?? undefined
  const ratingMin      = searchParams.get("ratingMin")  ? Number(searchParams.get("ratingMin"))  : undefined
  const ratingMax      = searchParams.get("ratingMax")  ? Number(searchParams.get("ratingMax"))  : undefined
  const dateFrom       = searchParams.get("dateFrom")   ? new Date(searchParams.get("dateFrom")!) : undefined
  const dateTo         = searchParams.get("dateTo")     ? new Date(searchParams.get("dateTo")!)   : undefined
  const page           = Math.max(1, Number(searchParams.get("page") ?? "1"))
  const pageSize       = 20

  const where = {
    organizationId: session.organizationId,
    ...(status         ? { status }                                    : {}),
    ...(classification ? { aiClassification: classification }          : {}),
    ...(category       ? { aiCategory: category }                      : {}),
    ...(source         ? { source }                                    : {}),
    ...(ratingMin !== undefined || ratingMax !== undefined
      ? { rating: {
          not: null,
          ...(ratingMin !== undefined ? { gte: ratingMin } : {}),
          ...(ratingMax !== undefined ? { lte: ratingMax } : {}),
        } }
      : {}),
    ...(dateFrom || dateTo
      ? { submittedAt: {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo   ? { lte: dateTo   } : {}),
        } }
      : {}),
  }

  const [reviews, total] = await Promise.all([
    prisma.customerFeedback.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      include: { location: { select: { id: true, name: true } } },
    }),
    prisma.customerFeedback.count({ where }),
  ])

  // Map to a stable API response shape with camelCase field names
  const items = reviews.map(r => ({
    id:               r.id,
    customerName:     r.customerName,
    rating:           r.rating,
    feedbackText:     r.feedbackText,
    submittedAt:      r.submittedAt.toISOString(),
    status:           r.status,
    source:           r.source,
    aiClassification: r.aiClassification,
    aiSentiment:      r.aiSentiment,
    aiUrgency:        r.aiUrgency,
    aiSummary:        r.aiSummary,
    aiCategory:       r.aiCategory,
    aiRecommendedAction: r.aiRecommendedAction,
    aiRecurrenceIndicator: r.aiRecurrenceIndicator,
    locationName:     r.location?.name ?? null,
    // Extract Google-specific fields from sourceMetadata for UI consumption
    reviewUrl: (r.sourceMetadata as Record<string, string> | null)?.reviewUrl ?? null,
  }))

  return NextResponse.json({
    reviews: items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}

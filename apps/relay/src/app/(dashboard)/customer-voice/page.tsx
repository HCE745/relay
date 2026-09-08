import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { CustomerVoiceClient } from "./customer-voice-client"

export const dynamic = "force-dynamic"

export default async function CustomerVoicePage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { customer_voice_enabled: true },
  })

  if (!org?.customer_voice_enabled) redirect("/dashboard")

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [connectedAccount, inboxItems, stats, ratingGroups, recentItems] = await Promise.all([
    prisma.connectedAccount.findUnique({
      where: { organizationId_provider: { organizationId: session.organizationId, provider: "google_business_profile" } },
      select: { accountEmail: true, lastSyncAt: true },
    }),
    prisma.customerFeedback.findMany({
      where: {
        organizationId: session.organizationId,
        status: { in: ["PENDING", "ISSUE_RECOMMENDED"] },
      },
      orderBy: { submittedAt: "desc" },
      take: 50,
      include: { location: { select: { id: true, name: true } } },
    }),
    prisma.customerFeedback.aggregate({
      where:  { organizationId: session.organizationId, rating: { not: null } },
      _avg:   { rating: true },
      _count: { _all: true },
    }),
    prisma.customerFeedback.groupBy({
      by:     ["rating"],
      where:  { organizationId: session.organizationId, rating: { not: null } },
      _count: { _all: true },
      orderBy: { rating: "asc" },
    }),
    prisma.customerFeedback.findMany({
      where:  { organizationId: session.organizationId, submittedAt: { gte: thirtyDaysAgo } },
      select: { submittedAt: true, rating: true },
      orderBy: { submittedAt: "asc" },
    }),
  ])

  const ratingDistribution = [1, 2, 3, 4, 5].map(r => ({
    rating: r,
    count: ratingGroups.find(g => g.rating === r)?._count._all ?? 0,
  }))

  // Group recent items by day for trend sparkline
  const trendMap = new Map<string, number>()
  for (const r of recentItems) {
    const day = r.submittedAt.toISOString().slice(0, 10)
    trendMap.set(day, (trendMap.get(day) ?? 0) + 1)
  }
  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  return (
    <div>
      <Header title="Customer Voice" />
      <div className="p-6">
        <CustomerVoiceClient
          connected={!!connectedAccount}
          connectedEmail={connectedAccount?.accountEmail ?? null}
          inboxReviews={inboxItems.map(r => ({
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
            reviewUrl: (r.sourceMetadata as Record<string, string> | null)?.reviewUrl ?? null,
          }))}
          insights={{
            totalReviews: stats._count._all,
            avgRating:    stats._avg.rating ?? null,
            ratingDistribution,
            trend,
          }}
        />
      </div>
    </div>
  )
}

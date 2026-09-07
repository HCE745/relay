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

  const [connectedAccount, inboxReviews, stats, ratingGroups, recentReviews] = await Promise.all([
    prisma.connectedAccount.findUnique({
      where: { organizationId_provider: { organizationId: session.organizationId, provider: "google_business_profile" } },
      select: { accountEmail: true, lastSyncAt: true },
    }),
    prisma.customerReview.findMany({
      where: { organizationId: session.organizationId, status: { in: ["PENDING", "ISSUE_RECOMMENDED"] } },
      orderBy: { publishedAt: "desc" },
      take: 50,
      include: { location: { select: { id: true, name: true } } },
    }),
    prisma.customerReview.aggregate({
      where: { organizationId: session.organizationId },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.customerReview.groupBy({
      by: ["rating"],
      where: { organizationId: session.organizationId },
      _count: { _all: true },
      orderBy: { rating: "asc" },
    }),
    prisma.customerReview.findMany({
      where: { organizationId: session.organizationId, publishedAt: { gte: thirtyDaysAgo } },
      select: { publishedAt: true, rating: true },
      orderBy: { publishedAt: "asc" },
    }),
  ])

  const ratingDistribution = [1, 2, 3, 4, 5].map(r => ({
    rating: r,
    count: ratingGroups.find(g => g.rating === r)?._count._all ?? 0,
  }))

  // Group recent reviews by day for trend
  const trendMap = new Map<string, number>()
  for (const r of recentReviews) {
    const day = r.publishedAt.toISOString().slice(0, 10)
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
          inboxReviews={inboxReviews.map(r => ({
            id: r.id,
            reviewerName: r.reviewerName,
            rating: r.rating,
            reviewText: r.reviewText,
            publishedAt: r.publishedAt.toISOString(),
            status: r.status,
            aiClassification: r.aiClassification,
            aiSummary: r.aiSummary,
            aiCategory: r.aiCategory,
            recommendedAction: r.recommendedAction,
            locationName: r.location?.name ?? null,
            sourceUrl: r.sourceUrl,
          }))}
          insights={{
            totalReviews: stats._count._all,
            avgRating: stats._avg.rating ?? null,
            ratingDistribution,
            trend,
          }}
        />
      </div>
    </div>
  )
}

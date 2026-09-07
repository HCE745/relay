import "server-only"
import { prisma } from "@/lib/prisma"
import { fetchGoogleLocations, fetchGoogleReviews } from "@/lib/google-business-api"
import { callHaiku } from "@/lib/ai-haiku"

// ── AI Classification ──────────────────────────────────────────────────────────

interface ReviewClassification {
  classification:   "ACTIONABLE" | "FEEDBACK" | "ARCHIVED"
  confidence:       number
  summary:          string
  category:         "EQUIPMENT" | "SAFETY" | "SERVICE" | "CLEANLINESS" | "FACILITY" | "OTHER"
  locationMatch:    string | null
  assetMention:     string | null
  recommendedAction: string | null
}

async function classifyReview(
  reviewText: string,
  rating:     number
): Promise<ReviewClassification | null> {
  const prompt = `You are analyzing a customer review for a business operations team. Classify this review and return ONLY valid JSON with no markdown or explanation.

Review (${rating} stars): "${reviewText}"

Return JSON:
{
  "classification": "ACTIONABLE" | "FEEDBACK" | "ARCHIVED",
  "confidence": 0.0-1.0,
  "summary": "one sentence summary of the issue or feedback",
  "category": "EQUIPMENT" | "SAFETY" | "SERVICE" | "CLEANLINESS" | "FACILITY" | "OTHER",
  "locationMatch": "specific location mentioned or null",
  "assetMention": "specific equipment mentioned or null",
  "recommendedAction": "one sentence action item if ACTIONABLE, null otherwise"
}

Classification rules:
- ACTIONABLE: 1-3 stars AND mentions a specific problem (broken equipment, safety issue, service failure, cleanliness problem). Needs a work order.
- FEEDBACK: 4-5 stars OR a general complaint without a specific actionable issue. Record and learn.
- ARCHIVED: Off-topic, spam, or irrelevant. No action needed.`

  const text = await callHaiku(prompt, { maxTokens: 300, timeoutMs: 8000 })
  if (!text) return null

  try {
    const cleaned = text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "")
    return JSON.parse(cleaned) as ReviewClassification
  } catch {
    return null
  }
}

// ── Main ingestion ─────────────────────────────────────────────────────────────

export interface IngestResult {
  locationsChecked: number
  reviewsNew:       number
  reviewsClassified: number
  errors:           string[]
}

export async function ingestReviews(organizationId: string): Promise<IngestResult> {
  const result: IngestResult = { locationsChecked: 0, reviewsNew: 0, reviewsClassified: 0, errors: [] }

  const account = await prisma.connectedAccount.findUnique({
    where: { organizationId_provider: { organizationId, provider: "google_business_profile" } },
  })
  if (!account) {
    result.errors.push("No connected Google Business Profile account")
    return result
  }

  let googleLocations: Awaited<ReturnType<typeof fetchGoogleLocations>>
  try {
    googleLocations = await fetchGoogleLocations(organizationId)
  } catch (err) {
    result.errors.push(`Failed to fetch locations: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  result.locationsChecked = googleLocations.length

  // Build a map from address/name to Relay Location for matching
  const relayLocations = await prisma.location.findMany({
    where:  { organizationId },
    select: { id: true, name: true, address: true },
  })

  function matchLocation(googleLoc: (typeof googleLocations)[0]): string | null {
    const gName = googleLoc.name.toLowerCase()
    const gAddr = googleLoc.address.toLowerCase()
    for (const rl of relayLocations) {
      if (rl.name.toLowerCase().includes(gName) || gName.includes(rl.name.toLowerCase())) return rl.id
      if (rl.address && gAddr && rl.address.toLowerCase().includes(gAddr.split(",")[0])) return rl.id
    }
    return null
  }

  const sinceDate = account.lastSyncAt ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  for (const googleLoc of googleLocations) {
    const matchedLocationId = matchLocation(googleLoc)
    let pageToken: string | null | undefined

    try {
      do {
        const { reviews, nextPageToken } = await fetchGoogleReviews(
          organizationId,
          googleLoc.googleLocationId,
          pageToken ?? undefined
        )
        pageToken = nextPageToken

        const recentReviews = reviews.filter(r => r.publishedAt >= sinceDate)

        for (const review of recentReviews) {
          // Skip if already stored
          const existing = await prisma.customerReview.findUnique({
            where: { googleReviewId: review.reviewId },
          })
          if (existing) continue

          // Classify with AI (non-blocking — save with null classification if AI fails)
          const classification = review.comment
            ? await classifyReview(review.comment, review.rating)
            : null

          await prisma.customerReview.create({
            data: {
              organizationId,
              locationId:       matchedLocationId,
              googleLocationId: googleLoc.googleLocationId,
              googleReviewId:   review.reviewId,
              reviewerName:     review.reviewerName,
              rating:           review.rating,
              reviewText:       review.comment,
              reviewReplyText:  review.replyText,
              publishedAt:      review.publishedAt,
              sourceUrl:        review.sourceUrl,
              aiClassification: classification?.classification ?? null,
              aiConfidence:     classification?.confidence ?? null,
              aiSummary:        classification?.summary ?? null,
              aiCategory:       classification?.category ?? null,
              aiLocationMatch:  classification?.locationMatch ?? null,
              aiAssetMention:   classification?.assetMention ?? null,
              recommendedAction: classification?.recommendedAction ?? null,
              status:           classification?.classification === "ACTIONABLE"
                ? "ISSUE_RECOMMENDED"
                : "PENDING",
            },
          })

          result.reviewsNew++
          if (classification) result.reviewsClassified++
        }

        // Stop paginating if we've passed the since date
        if (reviews.length > 0 && reviews[reviews.length - 1].publishedAt < sinceDate) break
      } while (pageToken)
    } catch (err) {
      result.errors.push(
        `Location ${googleLoc.name}: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // Update lastSyncAt per location pass
    await prisma.connectedAccount.update({
      where: { organizationId_provider: { organizationId, provider: "google_business_profile" } },
      data:  { lastSyncAt: new Date() },
    })
  }

  return result
}

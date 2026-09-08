import "server-only"
import { prisma } from "@/lib/prisma"
import { fetchGoogleLocations, fetchGoogleReviews } from "@/lib/google-business-api"
import { callHaiku } from "@/lib/ai-haiku"

// ── AI Classification ──────────────────────────────────────────────────────────

interface ReviewClassification {
  classification:       "ACTIONABLE" | "FEEDBACK" | "POSITIVE" | "ARCHIVED"
  confidence:           number
  summary:              string
  sentiment:            "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED"
  urgency:              "HIGH" | "MEDIUM" | "LOW"
  category:             "EQUIPMENT" | "SAFETY" | "SERVICE" | "CLEANLINESS" | "FACILITY" | "PRICING" | "STAFF" | "OTHER"
  assetMention:         string | null
  employeeMention:      string | null
  vendorMention:        string | null
  recurrenceIndicator:  boolean
  recommendedAction:    string | null
}

async function classifyReview(
  reviewText: string,
  rating:     number
): Promise<ReviewClassification | null> {
  const prompt = `You are analyzing a customer review for a business operations team. Classify this review and return ONLY valid JSON with no markdown or explanation.

Review (${rating} stars): "${reviewText}"

Return JSON:
{
  "classification": "ACTIONABLE" | "FEEDBACK" | "POSITIVE" | "ARCHIVED",
  "confidence": 0.0-1.0,
  "summary": "one sentence summary",
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED",
  "urgency": "HIGH" | "MEDIUM" | "LOW",
  "category": "EQUIPMENT" | "SAFETY" | "SERVICE" | "CLEANLINESS" | "FACILITY" | "PRICING" | "STAFF" | "OTHER",
  "assetMention": "specific equipment mentioned or null",
  "employeeMention": "employee name or role mentioned or null",
  "vendorMention": "vendor or supplier mentioned or null",
  "recurrenceIndicator": true | false,
  "recommendedAction": "one sentence action item if ACTIONABLE, null otherwise"
}

Classification rules:
- ACTIONABLE: 1-3 stars AND mentions a specific problem (broken equipment, safety issue, service failure, cleanliness problem). Needs a work order.
- FEEDBACK: 4-5 stars OR a general complaint without a specific actionable issue. Record and learn.
- POSITIVE: 4-5 stars with genuine praise, no problems mentioned.
- ARCHIVED: Off-topic, spam, or irrelevant. No action needed.

Urgency rules:
- HIGH: safety hazard, equipment failure causing downtime, or health risk.
- MEDIUM: service failure or significant cleanliness issue.
- LOW: minor complaint or general feedback.

Set recurrenceIndicator to true if the text implies this is a repeated or ongoing issue.`

  const text = await callHaiku(prompt, { maxTokens: 400, timeoutMs: 8000 })
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
  locationsChecked:  number
  reviewsNew:        number
  reviewsClassified: number
  errors:            string[]
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
          // Dedup: check if this externalId already exists for this org+source
          const existing = await prisma.customerFeedback.findFirst({
            where: { organizationId, source: "GOOGLE_REVIEW", externalId: review.reviewId },
            select: { id: true },
          })
          if (existing) continue

          // Classify with AI (non-blocking — save with null classification if AI fails)
          const classification = review.comment
            ? await classifyReview(review.comment, review.rating)
            : null

          await prisma.customerFeedback.create({
            data: {
              organizationId,
              locationId:    matchedLocationId,
              source:        "GOOGLE_REVIEW",
              externalId:    review.reviewId,
              customerName:  review.reviewerName,
              rating:        review.rating,
              feedbackText:  review.comment,
              submittedAt:   review.publishedAt,
              // Google-specific fields packed into sourceMetadata
              sourceMetadata: {
                googleLocationId: googleLoc.googleLocationId,
                reviewUrl:        review.sourceUrl ?? null,
                replyText:        review.replyText  ?? null,
              },
              aiClassification:     classification?.classification    ?? null,
              aiSentiment:          classification?.sentiment          ?? null,
              aiUrgency:            classification?.urgency            ?? null,
              aiConfidence:         classification?.confidence         ?? null,
              aiSummary:            classification?.summary            ?? null,
              aiCategory:           classification?.category           ?? null,
              aiAssetMention:       classification?.assetMention       ?? null,
              aiEmployeeMention:    classification?.employeeMention    ?? null,
              aiVendorMention:      classification?.vendorMention      ?? null,
              aiRecommendedAction:  classification?.recommendedAction  ?? null,
              aiRecurrenceIndicator: classification?.recurrenceIndicator ?? false,
              status: classification?.classification === "ACTIONABLE"
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

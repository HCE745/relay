import "server-only"
import { prisma } from "@/lib/prisma"
import { encryptToken, decryptToken } from "@/lib/connected-account-crypto"

const REFRESH_BUFFER_MS = 5 * 60 * 1000 // 5 minutes

export async function getValidAccessToken(organizationId: string): Promise<string> {
  const account = await prisma.connectedAccount.findUnique({
    where: { organizationId_provider: { organizationId, provider: "google_business_profile" } },
  })
  if (!account) throw new Error("No Google Business Profile account connected")

  // Return existing token if not close to expiry
  if (account.expiresAt.getTime() - Date.now() > REFRESH_BUFFER_MS) {
    return decryptToken(account.accessToken)
  }

  // Refresh the token
  const clientId     = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: decryptToken(account.refreshToken),
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token refresh failed: ${res.status} ${body}`)
  }

  const refreshed = await res.json() as { access_token: string; expires_in: number }
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000)

  await prisma.connectedAccount.update({
    where: { organizationId_provider: { organizationId, provider: "google_business_profile" } },
    data:  {
      accessToken: encryptToken(refreshed.access_token),
      expiresAt,
    },
  })

  return refreshed.access_token
}

// ── Locations ─────────────────────────────────────────────────────────────────

export interface GoogleLocation {
  googleLocationId: string
  name:             string
  address:          string
  accountName:      string
}

export async function fetchGoogleLocations(organizationId: string): Promise<GoogleLocation[]> {
  const token = await getValidAccessToken(organizationId)

  // List accounts
  const accountsRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!accountsRes.ok) throw new Error(`Failed to fetch Google accounts: ${accountsRes.status}`)

  const accountsData = await accountsRes.json() as { accounts?: Array<{ name: string; accountName: string }> }
  const accounts = accountsData.accounts ?? []

  const locations: GoogleLocation[] = []

  for (const account of accounts) {
    const locRes = await fetch(
      `https://mybusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!locRes.ok) continue

    const locData = await locRes.json() as {
      locations?: Array<{
        name:               string
        title?:             string
        storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string }
      }>
    }

    for (const loc of locData.locations ?? []) {
      const addr = loc.storefrontAddress
      const addressParts = [
        ...(addr?.addressLines ?? []),
        addr?.locality,
        addr?.administrativeArea,
      ].filter(Boolean)
      locations.push({
        googleLocationId: loc.name,
        name:             loc.title ?? loc.name,
        address:          addressParts.join(", "),
        accountName:      account.name,
      })
    }
  }

  return locations
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface GoogleReview {
  reviewId:   string
  reviewerName: string | null
  rating:     number
  comment:    string | null
  replyText:  string | null
  publishedAt: Date
  sourceUrl:  string | null
}

const STAR_MAP: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
}

export async function fetchGoogleReviews(
  organizationId:  string,
  googleLocationId: string,
  pageToken?:       string
): Promise<{ reviews: GoogleReview[]; nextPageToken: string | null }> {
  const token = await getValidAccessToken(organizationId)

  const params = new URLSearchParams({ pageSize: "50" })
  if (pageToken) params.set("pageToken", pageToken)

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${googleLocationId}/reviews?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to fetch reviews for ${googleLocationId}: ${res.status} ${body}`)
  }

  const data = await res.json() as {
    reviews?: Array<{
      reviewId:        string
      reviewer?:       { displayName?: string }
      starRating?:     string
      comment?:        string
      reviewReply?:    { comment?: string }
      createTime?:     string
      updateTime?:     string
      name?:           string
    }>
    nextPageToken?: string
  }

  const reviews: GoogleReview[] = (data.reviews ?? []).map(r => ({
    reviewId:     r.reviewId,
    reviewerName: r.reviewer?.displayName ?? null,
    rating:       STAR_MAP[r.starRating ?? ""] ?? 3,
    comment:      r.comment ?? null,
    replyText:    r.reviewReply?.comment ?? null,
    publishedAt:  new Date(r.createTime ?? r.updateTime ?? Date.now()),
    sourceUrl:    r.name ? `https://search.google.com/local/reviews?placeid=${r.name.split("/").pop()}` : null,
  }))

  return { reviews, nextPageToken: data.nextPageToken ?? null }
}

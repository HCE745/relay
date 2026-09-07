"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Star, MessageSquare, AlertCircle, CheckCircle, Archive, Plus, ChevronLeft, ChevronRight, Filter } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReviewItem {
  id: string
  reviewerName: string | null
  rating: number
  reviewText: string | null
  publishedAt: string
  status: string
  aiClassification: string | null
  aiSummary: string | null
  aiCategory: string | null
  recommendedAction: string | null
  locationName: string | null
  sourceUrl: string | null
}

interface Insights {
  totalReviews: number
  avgRating: number | null
  ratingDistribution: Array<{ rating: number; count: number }>
  trend: Array<{ date: string; count: number }>
}

// ── Star Rating ───────────────────────────────────────────────────────────────

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5"
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`${sz} ${i <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}`}
        />
      ))}
    </span>
  )
}

// ── Classification Badge ──────────────────────────────────────────────────────

function ClassBadge({ classification }: { classification: string | null }) {
  if (!classification) return null
  const map: Record<string, string> = {
    ACTIONABLE: "bg-red-100 text-red-700",
    FEEDBACK:   "bg-blue-100 text-blue-700",
    ARCHIVED:   "bg-gray-100 text-gray-500",
  }
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${map[classification] ?? "bg-gray-100 text-gray-500"}`}>
      {classification}
    </span>
  )
}

// ── Review Card ───────────────────────────────────────────────────────────────

function ReviewCard({ review, onAction }: { review: ReviewItem; onAction: (id: string, action: "issue" | "feedback" | "archive") => void }) {
  const [busy, setBusy] = useState<string | null>(null)

  async function act(action: "issue" | "feedback" | "archive") {
    setBusy(action)
    try {
      if (action === "issue") {
        await fetch(`/api/customer-voice/reviews/${review.id}/create-issue`, { method: "POST" })
      } else {
        await fetch(`/api/customer-voice/reviews/${review.id}/dismiss`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: action === "feedback" ? "feedback" : "archive" }),
        })
      }
      onAction(review.id, action)
    } finally { setBusy(null) }
  }

  const isActionable = review.aiClassification === "ACTIONABLE" || review.status === "ISSUE_RECOMMENDED"

  return (
    <div className={`bg-white border rounded-xl p-4 ${isActionable ? "border-red-200" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <StarRating rating={review.rating} />
          {review.locationName && (
            <span className="text-xs text-gray-400">{review.locationName}</span>
          )}
          <ClassBadge classification={review.aiClassification} />
        </div>
        <span className="text-xs text-gray-400 shrink-0">{format(new Date(review.publishedAt), "MMM d, yyyy")}</span>
      </div>

      {review.reviewerName && (
        <p className="text-xs font-semibold text-gray-600 mb-1">{review.reviewerName}</p>
      )}

      {review.reviewText && (
        <p className="text-sm text-gray-700 mb-3 leading-relaxed">{review.reviewText}</p>
      )}

      {review.aiSummary && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs font-semibold text-blue-700 mb-0.5">AI Summary</p>
          <p className="text-xs text-blue-800">{review.aiSummary}</p>
          {review.recommendedAction && (
            <p className="text-xs text-blue-600 mt-1 font-medium">→ {review.recommendedAction}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {(review.status === "PENDING" || review.status === "ISSUE_RECOMMENDED") && (
          <>
            {isActionable && (
              <button
                onClick={() => act("issue")}
                disabled={!!busy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {busy === "issue" ? "Creating…" : "Create Issue"}
              </button>
            )}
            <button
              onClick={() => act("feedback")}
              disabled={!!busy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 hover:border-blue-400 rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {busy === "feedback" ? "Saving…" : "Record as Feedback"}
            </button>
            <button
              onClick={() => act("archive")}
              disabled={!!busy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 hover:border-gray-400 rounded-lg transition-colors disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5" />
              {busy === "archive" ? "Archiving…" : "Archive"}
            </button>
          </>
        )}
        {review.sourceUrl && (
          <a href={review.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline">
            View on Google
          </a>
        )}
      </div>
    </div>
  )
}

// ── Inbox Tab ─────────────────────────────────────────────────────────────────

function InboxTab({ initialReviews }: { initialReviews: ReviewItem[] }) {
  const [reviews, setReviews] = useState(initialReviews)

  function handleAction(id: string) {
    setReviews(rs => rs.filter(r => r.id !== id))
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Inbox is clear</p>
        <p className="text-sm text-gray-400 mt-1">All reviews have been reviewed — check back after the next sync.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{reviews.length} review{reviews.length === 1 ? "" : "s"} awaiting action</p>
      {reviews.map(r => (
        <ReviewCard key={r.id} review={r} onAction={handleAction} />
      ))}
    </div>
  )
}

// ── All Reviews Tab ───────────────────────────────────────────────────────────

interface AllReviewsResponse {
  reviews: ReviewItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function AllReviewsTab() {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState("")
  const [ratingMin, setRatingMin] = useState("")

  async function load(p: number, status: string, rating: string) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (status) params.set("status", status)
      if (rating) params.set("ratingMax", rating)
      const res = await fetch(`/api/customer-voice/reviews?${params}`)
      if (res.ok) {
        const j = await res.json() as AllReviewsResponse
        setReviews(j.reviews)
        setTotalPages(j.totalPages)
        setTotal(j.total)
        setPage(j.page)
      }
    } finally { setLoading(false); setLoaded(true) }
  }

  function applyFilters() { load(1, statusFilter, ratingMin) }

  if (!loaded) {
    return (
      <div className="text-center py-8">
        <button
          onClick={() => load(1, "", "")}
          className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:border-blue-400 transition-colors"
        >
          Load Reviews
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ISSUE_RECOMMENDED">Action Recommended</option>
          <option value="ISSUE_CREATED">Issue Created</option>
          <option value="RECORDED_AS_FEEDBACK">Recorded as Feedback</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          value={ratingMin}
          onChange={e => setRatingMin(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Any Rating</option>
          <option value="1">1 Star</option>
          <option value="2">≤ 2 Stars</option>
          <option value="3">≤ 3 Stars</option>
        </select>
        <button
          onClick={applyFilters}
          className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:border-blue-400 transition-colors"
        >
          Apply
        </button>
        <span className="ml-auto text-xs text-gray-400">{total} result{total === 1 ? "" : "s"}</span>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No reviews match your filters.</div>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <StarRating rating={r.rating} />
                  {r.locationName && <span className="text-xs text-gray-400">{r.locationName}</span>}
                  <ClassBadge classification={r.aiClassification} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    r.status === "ISSUE_CREATED" ? "bg-green-100 text-green-700"
                    : r.status === "ARCHIVED" ? "bg-gray-100 text-gray-400"
                    : r.status === "RECORDED_AS_FEEDBACK" ? "bg-blue-100 text-blue-600"
                    : "bg-amber-100 text-amber-700"
                  }`}>{r.status.replace(/_/g, " ")}</span>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{format(new Date(r.publishedAt), "MMM d, yyyy")}</span>
              </div>
              {r.reviewerName && <p className="text-xs font-semibold text-gray-600 mb-1">{r.reviewerName}</p>}
              {r.reviewText && <p className="text-sm text-gray-700">{r.reviewText}</p>}
              {r.aiSummary && <p className="text-xs text-blue-600 mt-1 italic">{r.aiSummary}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            onClick={() => { const p = page - 1; setPage(p); load(p, statusFilter, ratingMin) }}
            disabled={page <= 1 || loading}
            className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button
            onClick={() => { const p = page + 1; setPage(p); load(p, statusFilter, ratingMin) }}
            disabled={page >= totalPages || loading}
            className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Insights Tab ──────────────────────────────────────────────────────────────

function InsightsTab({ insights }: { insights: Insights }) {
  const { totalReviews, avgRating, ratingDistribution, trend } = insights
  const maxCount = Math.max(...ratingDistribution.map(r => r.count), 1)
  const maxTrend = Math.max(...trend.map(t => t.count), 1)

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Reviews</p>
          <p className="text-3xl font-bold text-gray-900">{totalReviews.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Avg Rating</p>
          {avgRating !== null ? (
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-gray-900">{avgRating.toFixed(1)}</p>
              <StarRating rating={Math.round(avgRating)} size="lg" />
            </div>
          ) : (
            <p className="text-gray-400 text-sm mt-1">No data yet</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">30-Day Volume</p>
          <p className="text-3xl font-bold text-gray-900">
            {trend.reduce((s, t) => s + t.count, 0)}
          </p>
        </div>
      </div>

      {/* Rating distribution */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-900 mb-4">Rating Distribution</p>
        <div className="space-y-2">
          {[...ratingDistribution].reverse().map(({ rating, count }) => (
            <div key={rating} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-20 shrink-0">
                <span className="text-xs text-gray-600 w-3">{rating}</span>
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              </div>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-8 text-right tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 30-day trend */}
      {trend.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">30-Day Review Trend</p>
          <div className="flex items-end gap-1 h-20">
            {trend.map(({ date, count }) => (
              <div
                key={date}
                title={`${format(new Date(date + "T12:00:00"), "MMM d")}: ${count} review${count === 1 ? "" : "s"}`}
                className="flex-1 bg-blue-400 rounded-t min-h-[2px] transition-all hover:bg-blue-500 cursor-default"
                style={{ height: `${Math.max(4, (count / maxTrend) * 100)}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-400">{trend[0] ? format(new Date(trend[0].date + "T12:00:00"), "MMM d") : ""}</span>
            <span className="text-[10px] text-gray-400">{trend[trend.length - 1] ? format(new Date(trend[trend.length - 1].date + "T12:00:00"), "MMM d") : ""}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = "inbox" | "all" | "insights"

export function CustomerVoiceClient({
  connected,
  connectedEmail,
  inboxReviews,
  insights,
}: {
  connected: boolean
  connectedEmail: string | null
  inboxReviews: ReviewItem[]
  insights: Insights
}) {
  const [tab, setTab] = useState<Tab>("inbox")

  if (!connected) {
    return (
      <div className="max-w-2xl">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">No Google Business Profile connected</p>
            <p className="text-sm text-amber-800 mt-1">
              Connect your Google Business Profile to start syncing customer reviews and gaining insights.
            </p>
            <Link
              href="/settings/integrations"
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Connect in Settings
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "inbox",    label: `Inbox (${inboxReviews.length})` },
    { key: "all",      label: "All Reviews" },
    { key: "insights", label: "Insights" },
  ]

  return (
    <div className="max-w-3xl">
      {connectedEmail && (
        <div className="flex items-center gap-2 mb-5 text-xs text-gray-500">
          <MessageSquare className="w-3.5 h-3.5" />
          Syncing from <span className="font-medium text-gray-700">{connectedEmail}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 -mx-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "inbox"    && <InboxTab initialReviews={inboxReviews} />}
      {tab === "all"      && <AllReviewsTab />}
      {tab === "insights" && <InsightsTab insights={insights} />}
    </div>
  )
}

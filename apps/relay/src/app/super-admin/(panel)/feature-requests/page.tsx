import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { MessageSquare } from "lucide-react"
import { FeatureRequestActions } from "./feature-request-actions"

export const dynamic = "force-dynamic"

const STATUS_COLOR: Record<string, string> = {
  new:          "bg-indigo-900/60 text-indigo-300 border-indigo-800",
  under_review: "bg-amber-900/60 text-amber-300 border-amber-800",
  planned:      "bg-blue-900/60 text-blue-300 border-blue-800",
  declined:     "bg-gray-800 text-gray-400 border-gray-700",
  shipped:      "bg-green-900/60 text-green-300 border-green-800",
}

const TYPE_LABELS: Record<string, string> = {
  feature_request:     "Feature Request",
  product_feedback:    "Product Feedback",
  ui_ux_suggestion:    "UI/UX Suggestion",
  integration_request: "Integration Request",
  pricing_feedback:    "Pricing Feedback",
  general_suggestion:  "General Suggestion",
}

const TYPE_BADGE: Record<string, string> = {
  feature_request:     "bg-amber-900/60 text-amber-300 border-amber-800",
  product_feedback:    "bg-violet-900/60 text-violet-300 border-violet-800",
  ui_ux_suggestion:    "bg-pink-900/60 text-pink-300 border-pink-800",
  integration_request: "bg-cyan-900/60 text-cyan-300 border-cyan-800",
  pricing_feedback:    "bg-orange-900/60 text-orange-300 border-orange-800",
  general_suggestion:  "bg-gray-800 text-gray-300 border-gray-700",
}

const FREQ_LABEL: Record<string, string> = {
  daily:   "Daily",
  weekly:  "Weekly",
  monthly: "Monthly",
  rarely:  "Rarely",
}

const FEEDBACK_TYPES = [
  "feature_request", "product_feedback", "ui_ux_suggestion",
  "integration_request", "pricing_feedback", "general_suggestion",
]

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; q?: string }>
}) {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const { status, type, q } = await searchParams
  const activeStatus = status ?? "all"
  const activeType   = type   ?? "all"

  const where: Record<string, unknown> = {}
  if (activeStatus !== "all") where.status       = activeStatus
  if (activeType   !== "all") where.feedbackType = activeType
  if (q) {
    where.OR = [
      { orgName:         { contains: q, mode: "insensitive" } },
      { submittedByName: { contains: q, mode: "insensitive" } },
      { description:     { contains: q, mode: "insensitive" } },
      { submitterEmail:  { contains: q, mode: "insensitive" } },
    ]
  }

  const [submissions, statusCounts, typeCounts] = await Promise.all([
    prisma.featureRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id:              true,
        orgName:         true,
        submittedByName: true,
        submittedByRole: true,
        submitterEmail:  true,
        feedbackType:    true,
        description:     true,
        useCase:         true,
        frequency:       true,
        status:          true,
        createdAt:       true,
        organization:    { select: { plan: true } },
      },
    }),
    prisma.featureRequest.groupBy({
      by:     ["status"],
      _count: { id: true },
    }),
    prisma.featureRequest.groupBy({
      by:     ["feedbackType"],
      _count: { id: true },
    }),
  ])

  const statusCountMap = Object.fromEntries(statusCounts.map(c => [c.status, c._count.id]))
  const typeCountMap   = Object.fromEntries(typeCounts.map(c => [c.feedbackType, c._count.id]))
  const total          = Object.values(statusCountMap).reduce((a, b) => a + b, 0)

  const STATUS_TABS = [
    { key: "all",          label: "All",          count: total },
    { key: "new",          label: "New",          count: statusCountMap["new"]          ?? 0 },
    { key: "under_review", label: "Under Review", count: statusCountMap["under_review"] ?? 0 },
    { key: "planned",      label: "Planned",      count: statusCountMap["planned"]      ?? 0 },
    { key: "shipped",      label: "Shipped",      count: statusCountMap["shipped"]      ?? 0 },
    { key: "declined",     label: "Declined",     count: statusCountMap["declined"]     ?? 0 },
  ]

  function buildUrl(params: Record<string, string>) {
    const p: Record<string, string> = {
      status: activeStatus,
      type:   activeType,
      ...(q ? { q } : {}),
      ...params,
    }
    const qs = Object.entries(p)
      .filter(([, v]) => v && v !== "all")
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&")
    return `/super-admin/feature-requests${qs ? `?${qs}` : ""}`
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-5 h-5 text-indigo-400" />
        <h1 className="text-xl font-bold text-white">Feedback</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 border border-indigo-800 font-medium">
          {statusCountMap["new"] ?? 0} new
        </span>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {STATUS_TABS.map(tab => (
          <a
            key={tab.key}
            href={buildUrl({ status: tab.key })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeStatus === tab.key
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
            {tab.count > 0 && <span className="ml-1.5 opacity-70">{tab.count}</span>}
          </a>
        ))}
      </div>

      {/* Feedback type filter */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        <a
          href={buildUrl({ type: "all" })}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            activeType === "all"
              ? "bg-gray-600 text-white"
              : "bg-gray-800/60 text-gray-500 hover:text-gray-300"
          }`}
        >
          All types
        </a>
        {FEEDBACK_TYPES.map(ft => {
          const count = typeCountMap[ft] ?? 0
          return (
            <a
              key={ft}
              href={buildUrl({ type: ft })}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeType === ft
                  ? "bg-gray-600 text-white"
                  : "bg-gray-800/60 text-gray-500 hover:text-gray-300"
              }`}
            >
              {TYPE_LABELS[ft]}
              {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
            </a>
          )
        })}
      </div>

      {/* Search */}
      <form className="mb-5" method="get">
        <input type="hidden" name="status" value={activeStatus} />
        <input type="hidden" name="type"   value={activeType} />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by org, name, email, or content…"
          className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </form>

      {/* List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {submissions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No feedback found.</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {submissions.map(r => {
              const typeLabel = TYPE_LABELS[r.feedbackType] ?? r.feedbackType
              const typeBadge = TYPE_BADGE[r.feedbackType] ?? TYPE_BADGE.general_suggestion
              const plan      = r.organization?.plan
              const isVisitor = r.submittedByRole === "Visitor"

              return (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeBadge}`}>
                          {typeLabel}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[r.status] ?? STATUS_COLOR.new}`}>
                          {r.status.replace("_", " ")}
                        </span>
                        {r.frequency && (
                          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                            {FREQ_LABEL[r.frequency] ?? r.frequency}
                          </span>
                        )}
                        {plan && (
                          <span className="text-xs text-gray-600 bg-gray-800/60 px-2 py-0.5 rounded-full">
                            {plan}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white font-medium mb-1">{r.description}</p>
                      {r.useCase && (
                        <p className="text-xs text-gray-400 mb-1 leading-relaxed">{r.useCase}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {isVisitor ? (
                          <>
                            {r.submittedByName}
                            {r.submitterEmail && (
                              <> · <a href={`mailto:${r.submitterEmail}`} className="text-indigo-400 hover:underline">{r.submitterEmail}</a></>
                            )}
                            {" "}· <span className="text-gray-600">Public form</span>
                          </>
                        ) : (
                          <>
                            {r.orgName && <>{r.orgName} · </>}
                            {r.submittedByName} ({r.submittedByRole})
                            {r.submitterEmail && (
                              <> · <a href={`mailto:${r.submitterEmail}`} className="text-indigo-400 hover:underline">{r.submitterEmail}</a></>
                            )}
                          </>
                        )}
                        {" "}· {format(new Date(r.createdAt), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                    <FeatureRequestActions id={r.id} currentStatus={r.status} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

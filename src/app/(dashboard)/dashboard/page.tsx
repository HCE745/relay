import { Header } from "@/components/layout/header"
import { getDisplaySession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { WelcomeChecklist } from "@/components/dashboard/welcome-checklist"
import {
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Package,
  AlertTriangle,
  ArrowRight,
  ChevronUp,
  Lightbulb,
  Clock,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PRIORITY_COLOR, STATUS_COLOR, ISSUE_STATUS, ISSUE_PRIORITY, ISSUE_CATEGORY } from "@/lib/constants"
import { formatDistanceToNow } from "date-fns"

async function getDashboardData(orgId: string) {
  const [
    totalIssues,
    openIssues,
    escalatedIssues,
    resolvedIssues,
    criticalIssues,
    totalAssets,
    recentIssues,
    issuesByCategory,
    totalSuggestions,
    pendingSuggestions,
    recentSuggestions,
  ] = await Promise.all([
    prisma.issue.count({ where: { organizationId: orgId } }),
    prisma.issue.count({ where: { organizationId: orgId, status: "OPEN" } }),
    prisma.issue.count({ where: { organizationId: orgId, isEscalated: true } }),
    prisma.issue.count({ where: { organizationId: orgId, status: "RESOLVED" } }),
    prisma.issue.count({ where: { organizationId: orgId, priority: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.asset.count({ where: { organizationId: orgId } }),
    prisma.issue.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        reportedBy: { select: { name: true } },
        location: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.issue.groupBy({
      by: ["category"],
      where: { organizationId: orgId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.suggestion.count({ where: { organizationId: orgId } }),
    prisma.suggestion.count({ where: { organizationId: orgId, status: "PENDING" } }),
    prisma.suggestion.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, content: true, status: true, createdAt: true, detectedCategory: true },
    }),
  ])

  return {
    totalIssues, openIssues, escalatedIssues, resolvedIssues, criticalIssues,
    totalAssets, recentIssues, issuesByCategory,
    totalSuggestions, pendingSuggestions, recentSuggestions,
  }
}

export const dynamic = "force-dynamic"

const CHECKLIST_CUTOFF_DAYS = 14

async function getChecklistData(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, createdAt: true },
  })
  if (!org) return null
  const ageMs = Date.now() - new Date(org.createdAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  if (ageDays > CHECKLIST_CUTOFF_DAYS) return null

  const [issues, users, locations, routingRules, qrCodes] = await Promise.all([
    prisma.issue.count({ where: { organizationId: orgId } }),
    prisma.user.count({ where: { organizationId: orgId } }),
    prisma.location.count({ where: { organizationId: orgId } }),
    prisma.routingRule.count({ where: { organizationId: orgId } }),
    prisma.qrCode.count({ where: { organizationId: orgId } }),
  ])

  return {
    orgName: org.name,
    items: [
      { label: "Add your first location",    description: "Add a site, building, or floor to organize your workspace.", done: locations > 0,    href: "/locations" },
      { label: "Invite your first team member", description: "Add colleagues so they can submit and manage issues.",    done: users > 1,        href: "/team" },
      { label: "Submit your first issue",    description: "Report a problem, request, or maintenance task.",           done: issues > 0,       href: "/issues/new" },
      { label: "Set up routing rules",       description: "Auto-assign issues based on category and location.",        done: routingRules > 0, href: "/settings/routing" },
      { label: "Configure your first QR code", description: "Link a QR code to a location so staff can scan to report issues.", done: qrCodes > 0, href: "/qr-codes" },
    ],
  }
}

export default async function DashboardPage() {
  const session = await getDisplaySession()
  const [data, checklist] = await Promise.all([
    getDashboardData(session?.organizationId ?? ""),
    getChecklistData(session?.organizationId ?? ""),
  ])

  const stats = [
    {
      label: "Open Issues",
      value: data.openIssues,
      icon: AlertCircle,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/issues?status=OPEN",
    },
    {
      label: "Critical",
      value: data.criticalIssues,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
      href: "/issues?priority=CRITICAL",
    },
    {
      label: "Escalated",
      value: data.escalatedIssues,
      icon: ChevronUp,
      color: "text-orange-600",
      bg: "bg-orange-50",
      href: "/issues?status=ESCALATED",
    },
    {
      label: "Resolved",
      value: data.resolvedIssues,
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50",
      href: "/issues?status=RESOLVED",
    },
    {
      label: "Total Assets",
      value: data.totalAssets,
      icon: Package,
      color: "text-purple-600",
      bg: "bg-purple-50",
      href: "/assets",
    },
    {
      label: "Total Issues",
      value: data.totalIssues,
      icon: TrendingUp,
      color: "text-gray-600",
      bg: "bg-gray-50",
      href: "/issues",
    },
  ]

  return (
    <div>
      <Header title={`Good morning, ${session?.displayName?.split(" ")[0]} 👋`} />

      {/* Mobile greeting */}
      <div className="md:hidden px-4 pt-4 pb-1">
        <h1 className="text-lg font-bold text-gray-900">
          Hey, {session?.displayName?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Here&apos;s what&apos;s happening</p>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6 space-y-4 md:space-y-6">
        {/* Welcome checklist — only for new non-demo orgs */}
        {checklist && checklist.items.filter(i => !i.done).length > 0 && !session?.isDemo && (
          <WelcomeChecklist items={checklist.items} orgName={checklist.orgName} />
        )}

        {/* Stats Grid */}
        <div data-tour="kpi-cards" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
            <Link
              key={label}
              href={href}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{label}</div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Issues */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Recent Issues</h2>
              <Link href="/issues" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {data.recentIssues.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">No issues yet</div>
              ) : (
                data.recentIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/issues/${issue.id}`}
                    className="flex items-start gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 truncate">{issue.title}</span>
                        <Badge className={PRIORITY_COLOR[issue.priority]}>
                          {ISSUE_PRIORITY[issue.priority as keyof typeof ISSUE_PRIORITY] ?? issue.priority}
                        </Badge>
                        <Badge className={STATUS_COLOR[issue.status]}>
                          {ISSUE_STATUS[issue.status as keyof typeof ISSUE_STATUS] ?? issue.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
                        </span>
                        {issue.location && (
                          <span className="text-xs text-gray-400">📍 {issue.location.name}</span>
                        )}
                        {issue.assignedTo && (
                          <span className="text-xs text-gray-400">→ {issue.assignedTo.name}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Right column: category breakdown + suggestions */}
          <div className="space-y-6">
            {/* Issues by Category */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">By Category</h2>
              </div>
              <div className="px-6 py-4 space-y-3">
                {data.issuesByCategory.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
                ) : (
                  data.issuesByCategory.slice(0, 8).map((item) => {
                    const total = data.totalIssues || 1
                    const pct = Math.round((item._count.id / total) * 100)
                    return (
                      <div key={item.category}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700">
                            {ISSUE_CATEGORY[item.category as keyof typeof ISSUE_CATEGORY] ?? item.category}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{item._count.id}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Suggestions Summary */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  Suggestions
                </h2>
                <Link
                  href="/suggestions"
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Stat counters */}
              <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
                <div className="px-6 py-4">
                  <div className="text-2xl font-bold text-gray-900">{data.totalSuggestions}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Total</div>
                </div>
                <div className="px-6 py-4">
                  <div className="text-2xl font-bold text-yellow-600">{data.pendingSuggestions}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Pending</div>
                </div>
              </div>

              {/* Recent suggestions */}
              <div className="divide-y divide-gray-50">
                {data.recentSuggestions.length === 0 ? (
                  <p className="px-6 py-6 text-sm text-gray-400 text-center">No suggestions yet</p>
                ) : (
                  data.recentSuggestions.map((s) => (
                    <Link
                      key={s.id}
                      href="/suggestions"
                      className="flex items-start gap-3 px-6 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-700 line-clamp-2 leading-snug">{s.content}</p>
                        <span className="text-xs text-gray-400 mt-0.5 block">
                          {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

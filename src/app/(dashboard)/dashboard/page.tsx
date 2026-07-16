import { Header } from "@/components/layout/header"
import { getDisplaySession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { WelcomeChecklist } from "@/components/dashboard/welcome-checklist"
import { ReferralCard } from "@/components/dashboard/referral-card"
import { getActiveReferralProgram } from "@/lib/billing-credits-engine"
import {
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Package,
  AlertTriangle,
  ArrowRight,
  ChevronUp,
  Lightbulb,
  MapPin,
  Bot,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PRIORITY_COLOR, STATUS_COLOR, ISSUE_STATUS, ISSUE_PRIORITY, ISSUE_CATEGORY } from "@/lib/constants"
import { formatDistanceToNow } from "date-fns"

const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH:     "bg-orange-500",
  MEDIUM:   "bg-amber-400",
  LOW:      "bg-blue-400",
}

const CATEGORY_COLOR: Record<string, string> = {
  INJURY:              "bg-red-500",
  SAFETY:              "bg-red-500",
  EQUIPMENT_BREAKDOWN: "bg-orange-500",
  MAINTENANCE:         "bg-amber-500",
  SUPPLY_SHORTAGE:     "bg-yellow-500",
  CUSTOMER_COMPLAINT:  "bg-purple-500",
  FACILITY:            "bg-blue-500",
  VEHICLE:             "bg-cyan-500",
  EMPLOYEE:            "bg-indigo-500",
  GENERAL:             "bg-slate-400",
}

async function getDashboardData(orgId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

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
    newThisWeek,
    resolvedThisWeek,
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
    prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: weekAgo } } }),
    prisma.issue.count({ where: { organizationId: orgId, status: { in: ["RESOLVED", "CLOSED"] }, updatedAt: { gte: weekAgo } } }),
  ])

  return {
    totalIssues, openIssues, escalatedIssues, resolvedIssues, criticalIssues,
    totalAssets, recentIssues, issuesByCategory,
    totalSuggestions, pendingSuggestions, recentSuggestions,
    newThisWeek, resolvedThisWeek,
  }
}

async function getReferralCardData(orgId: string) {
  const [org, program] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { referralCode: true, referralLink: true },
    }),
    getActiveReferralProgram(),
  ])

  if (!program?.showOnDashboard || !org) return null

  const [submitted, qualified, rewarded] = await Promise.all([
    prisma.referral.count({ where: { referrerOrgId: orgId } }),
    prisma.referral.count({ where: { referrerOrgId: orgId, qualifiedAt: { not: null } } }),
    prisma.referral.count({ where: { referrerOrgId: orgId, rewardStatus: "rewarded" } }),
  ])

  return {
    referralCode:    org.referralCode,
    referralLink:    org.referralLink,
    cardTitle:       program.cardTitle,
    cardDescription: program.cardDescription,
    stats: {
      submitted,
      qualified,
      pending:       submitted - rewarded - (qualified - rewarded),
      creditsEarned: rewarded * (program.referrerRewardCycles ?? 1),
    },
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
      { label: "Add your first location",       description: "Add a site, building, or floor to organize your workspace.", done: locations > 0,    href: "/locations" },
      { label: "Invite your first team member", description: "Add colleagues so they can submit and manage issues.",        done: users > 1,        href: "/team" },
      { label: "Submit your first issue",       description: "Report a problem, request, or maintenance task.",            done: issues > 0,       href: "/issues/new" },
      { label: "Set up routing rules",          description: "Auto-assign issues based on category and location.",         done: routingRules > 0, href: "/settings/routing" },
      { label: "Configure your first QR code", description: "Link a QR code to a location so staff can scan to report.", done: qrCodes > 0,      href: "/qr-codes" },
    ],
  }
}

function computeHealthScore(openIssues: number, criticalIssues: number, escalatedIssues: number, resolvedThisWeek: number): number {
  let score = 100
  score -= Math.min(openIssues, 20)
  score -= Math.min(criticalIssues * 5, 25)
  score -= Math.min(escalatedIssues * 3, 15)
  score += Math.min(resolvedThisWeek, 10)
  return Math.max(0, Math.min(100, score))
}

function getHealthInfo(score: number) {
  if (score >= 80) return { label: "GOOD",    text: "text-emerald-600", bg: "bg-emerald-50",  border: "border-emerald-200" }
  if (score >= 60) return { label: "FAIR",    text: "text-amber-600",   bg: "bg-amber-50",    border: "border-amber-200"   }
  return              { label: "AT RISK", text: "text-red-600",     bg: "bg-red-50",      border: "border-red-200"     }
}

function getAiInsight(d: { openIssues: number; criticalIssues: number; escalatedIssues: number; resolvedThisWeek: number; newThisWeek: number }) {
  if (d.criticalIssues > 0) return {
    insight: `${d.criticalIssues} critical issue${d.criticalIssues > 1 ? "s" : ""} active — immediate attention required`,
    recommendation: "Prioritize critical issues before end of shift to prevent further escalation",
  }
  if (d.escalatedIssues > 0) return {
    insight: `${d.escalatedIssues} escalated issue${d.escalatedIssues > 1 ? "s" : ""} in progress — response time monitoring active`,
    recommendation: "Update stakeholders on escalation status and set clear resolution targets",
  }
  if (d.openIssues > 10) return {
    insight: `${d.openIssues} open issues pending — queue above normal levels`,
    recommendation: "Consider batch-assigning items to reduce backlog and improve response time",
  }
  if (d.resolvedThisWeek > 0) return {
    insight: `${d.resolvedThisWeek} issue${d.resolvedThisWeek > 1 ? "s" : ""} resolved this week — operations on track`,
    recommendation: "Continue current response protocols and review SOPs for efficiency gains",
  }
  return {
    insight: "No active issues detected — operations running smoothly",
    recommendation: "Use downtime to review SOPs and ensure team preparedness",
  }
}

function getWaiting(createdAt: Date, status: string): { label: string; cls: string } | null {
  if (!["OPEN", "IN_PROGRESS", "ESCALATED", "PENDING_VENDOR"].includes(status)) return null
  const ms = Date.now() - new Date(createdAt).getTime()
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const label = days > 0 ? `${days}d waiting` : hours > 0 ? `${hours}h waiting` : `${minutes}m waiting`
  const cls = minutes > 240 ? "text-red-600 font-semibold" : minutes > 120 ? "text-amber-600 font-medium" : "text-gray-400"
  return { label, cls }
}

export default async function DashboardPage() {
  const session = await getDisplaySession()
  const canSeeReferrals = session?.role === "ADMIN" || session?.role === "MANAGER"
  const [data, checklist, referralCard] = await Promise.all([
    getDashboardData(session?.organizationId ?? ""),
    getChecklistData(session?.organizationId ?? ""),
    canSeeReferrals ? getReferralCardData(session?.organizationId ?? "") : Promise.resolve(null),
  ])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const firstName = session?.displayName?.split(" ")[0] ?? "there"

  const healthScore = computeHealthScore(data.openIssues, data.criticalIssues, data.escalatedIssues, data.resolvedThisWeek)
  const healthInfo = getHealthInfo(healthScore)
  const aiInsight = getAiInsight(data)

  const headerSubtitle = [
    data.openIssues > 0   && `${data.openIssues} open`,
    data.criticalIssues > 0 && `${data.criticalIssues} critical`,
    data.escalatedIssues > 0 && `${data.escalatedIssues} escalated`,
    data.resolvedThisWeek > 0 && `${data.resolvedThisWeek} resolved this week`,
  ].filter(Boolean).join(" · ")

  const stats = [
    {
      label: "Open Issues",
      value: data.openIssues,
      icon: AlertCircle,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-100",
      accentBorder: "border-l-blue-500",
      href: "/issues?status=OPEN",
      secondary: data.newThisWeek > 0 ? `${data.newThisWeek} new this week` : "No new this week",
      secondaryColor: data.newThisWeek > 0 ? "text-amber-600" : "text-gray-400",
      trend: data.newThisWeek > 0 ? { sign: "▲", val: data.newThisWeek, cls: "text-amber-500" } : null,
    },
    {
      label: "Critical",
      value: data.criticalIssues,
      icon: AlertTriangle,
      iconColor: "text-red-600",
      iconBg: "bg-red-100",
      accentBorder: "border-l-red-500",
      href: "/issues?priority=CRITICAL",
      secondary: "Highest priority",
      secondaryColor: "text-gray-400",
      trend: data.criticalIssues > 0 ? { sign: "!", val: null, cls: "text-red-500" } : null,
    },
    {
      label: "Escalated",
      value: data.escalatedIssues,
      icon: ChevronUp,
      iconColor: "text-orange-600",
      iconBg: "bg-orange-100",
      accentBorder: "border-l-orange-500",
      href: "/issues?status=ESCALATED",
      secondary: "Requires response",
      secondaryColor: "text-gray-400",
      trend: null,
    },
    {
      label: "Resolved",
      value: data.resolvedIssues,
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-100",
      accentBorder: "border-l-emerald-500",
      href: "/issues?status=RESOLVED",
      secondary: data.resolvedThisWeek > 0 ? `${data.resolvedThisWeek} this week` : "None this week",
      secondaryColor: data.resolvedThisWeek > 0 ? "text-emerald-600" : "text-gray-400",
      trend: data.resolvedThisWeek > 0 ? { sign: "▲", val: data.resolvedThisWeek, cls: "text-emerald-500" } : null,
    },
    {
      label: "Total Assets",
      value: data.totalAssets,
      icon: Package,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-100",
      accentBorder: "border-l-violet-500",
      href: "/assets",
      secondary: "Tracked",
      secondaryColor: "text-gray-400",
      trend: null,
    },
    {
      label: "Total Issues",
      value: data.totalIssues,
      icon: TrendingUp,
      iconColor: "text-gray-500",
      iconBg: "bg-gray-100",
      accentBorder: "border-l-gray-400",
      href: "/issues",
      secondary: data.newThisWeek > 0 ? `${data.newThisWeek} added this week` : "None this week",
      secondaryColor: "text-gray-400",
      trend: null,
    },
  ]

  return (
    <div>
      <Header
        title={`${greeting}, ${firstName} 👋`}
        subtitle={headerSubtitle || undefined}
      />

      {/* Mobile greeting */}
      <div className="md:hidden px-4 pt-4 pb-1">
        <h1 className="text-lg font-bold text-gray-900">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Here&apos;s what&apos;s happening</p>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6 space-y-5">
        {/* Welcome checklist — only for new non-demo orgs */}
        {checklist && checklist.items.filter(i => !i.done).length > 0 && !session?.isDemo && (
          <WelcomeChecklist items={checklist.items} orgName={checklist.orgName} />
        )}

        {referralCard && (
          <ReferralCard
            referralCode={referralCard.referralCode}
            referralLink={referralCard.referralLink}
            cardTitle={referralCard.cardTitle}
            cardDescription={referralCard.cardDescription}
            stats={referralCard.stats}
          />
        )}

        {/* ── Executive Summary ──────────────────────────────────────────── */}
        <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="px-6 py-5 flex items-start gap-8">
            {/* Health Score */}
            <div className="shrink-0 text-center min-w-[96px]">
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">Health Score</p>
              <div className={`text-5xl font-black leading-none ${healthInfo.text}`}>{healthScore}</div>
              <span className={`inline-block mt-2 text-[10px] font-bold px-2.5 py-1 rounded-full border ${healthInfo.bg} ${healthInfo.text} ${healthInfo.border}`}>
                {healthInfo.label}
              </span>
            </div>

            <div className="w-px self-stretch bg-gray-100" />

            {/* Stats + AI Insight */}
            <div className="flex-1 min-w-0">
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-6 mb-4">
                <div>
                  <div className="text-2xl font-black text-gray-900">{data.openIssues}</div>
                  <div className="text-xs text-gray-400 mt-0.5 font-medium">Open</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-red-600">{data.criticalIssues}</div>
                  <div className="text-xs text-gray-400 mt-0.5 font-medium">Critical</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-orange-600">{data.escalatedIssues}</div>
                  <div className="text-xs text-gray-400 mt-0.5 font-medium">Escalated</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-emerald-600">{data.resolvedThisWeek}</div>
                  <div className="text-xs text-gray-400 mt-0.5 font-medium">Resolved / wk</div>
                </div>
              </div>

              {/* AI Insight */}
              <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <div className="flex items-start gap-2.5">
                  <Bot className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-800 font-semibold leading-snug">{aiInsight.insight}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{aiInsight.recommendation}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
        <div data-tour="kpi-cards" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map(({ label, value, icon: Icon, iconColor, iconBg, accentBorder, href, secondary, secondaryColor, trend }) => (
            <Link
              key={label}
              href={href}
              className={`bg-white rounded-xl border border-gray-200 border-l-4 ${accentBorder} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 ${iconBg} rounded-full flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${iconColor}`} style={{ width: "18px", height: "18px" }} />
                </div>
                {trend && (
                  <span className={`text-xs font-bold ${trend.cls}`}>
                    {trend.sign}{trend.val !== null ? ` ${trend.val}` : ""}
                  </span>
                )}
              </div>
              <div className="text-3xl font-black text-gray-900 leading-none">{value}</div>
              <div className="text-[13px] font-medium text-gray-500 mt-1">{label}</div>
              <div className={`text-[11px] mt-1.5 ${secondaryColor}`}>{secondary}</div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Recent Issues ─────────────────────────────────────────── */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Recent Issues</h2>
              <Link href="/issues" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {data.recentIssues.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <AlertCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No issues yet</p>
                </div>
              ) : (
                data.recentIssues.map((issue) => {
                  const waiting = getWaiting(issue.createdAt, issue.status)
                  const dot = PRIORITY_DOT[issue.priority] ?? "bg-gray-300"
                  const assigneeInitial = issue.assignedTo?.name?.charAt(0).toUpperCase()

                  return (
                    <Link
                      key={issue.id}
                      href={`/issues/${issue.id}`}
                      className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group"
                    >
                      {/* Severity dot */}
                      <div className="shrink-0 pt-[7px]">
                        <div className={`w-2 h-2 rounded-full ${dot}`} />
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-gray-900 truncate max-w-[260px]">{issue.title}</span>
                          <Badge className={`${PRIORITY_COLOR[issue.priority]} text-[10px] px-1.5 py-0 border`}>
                            {ISSUE_PRIORITY[issue.priority as keyof typeof ISSUE_PRIORITY] ?? issue.priority}
                          </Badge>
                          <Badge className={`${STATUS_COLOR[issue.status]} text-[10px] px-1.5 py-0 border`}>
                            {ISSUE_STATUS[issue.status as keyof typeof ISSUE_STATUS] ?? issue.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs text-gray-400 flex-wrap">
                          <span>{formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</span>
                          {issue.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {issue.location.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: assignee avatar + waiting time */}
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        {assigneeInitial && (
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-indigo-700">{assigneeInitial}</span>
                          </div>
                        )}
                        {waiting && (
                          <span className={`text-[11px] ${waiting.cls} whitespace-nowrap`}>{waiting.label}</span>
                        )}
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* ── Issues by Category ─────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">By Category</h2>
                <span className="text-xs text-gray-400 font-medium">{data.totalIssues} total</span>
              </div>
              <div className="px-5 py-4 space-y-3.5">
                {data.issuesByCategory.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
                ) : (
                  data.issuesByCategory.slice(0, 8).map((item) => {
                    const total = data.totalIssues || 1
                    const pct = Math.round((item._count.id / total) * 100)
                    const barColor = CATEGORY_COLOR[item.category] ?? "bg-blue-400"
                    const label = ISSUE_CATEGORY[item.category as keyof typeof ISSUE_CATEGORY] ?? item.category

                    return (
                      <div key={item.category}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[13px] font-medium text-gray-700 truncate max-w-[140px]">{label}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-gray-400">{pct}%</span>
                            <span className="text-[13px] font-bold text-gray-900 w-5 text-right">{item._count.id}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`${barColor} h-1.5 rounded-full transition-all`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* ── Suggestions ────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  Suggestions
                </h2>
                <Link href="/suggestions" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
                <div className="px-5 py-3.5">
                  <div className="text-2xl font-black text-gray-900">{data.totalSuggestions}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 font-medium">Total</div>
                </div>
                <div className="px-5 py-3.5">
                  <div className="text-2xl font-black text-amber-600">{data.pendingSuggestions}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 font-medium">Pending</div>
                </div>
              </div>

              <div className="divide-y divide-gray-50">
                {data.recentSuggestions.length === 0 ? (
                  <div className="px-5 py-7 text-center">
                    <div className="w-11 h-11 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Bot className="w-5 h-5 text-blue-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">No suggestions yet</p>
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed max-w-[200px] mx-auto">
                      Relay AI is continuously analyzing your operational data. Suggestions will appear as patterns emerge.
                    </p>
                  </div>
                ) : (
                  data.recentSuggestions.map((s) => (
                    <Link
                      key={s.id}
                      href="/suggestions"
                      className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 shrink-0" />
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

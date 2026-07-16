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
  MapPin,
  Bot,
  Sparkles,
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

// Semantic color per category — matches KPI card colors
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
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    totalIssues,
    openIssues,
    escalatedIssues,
    resolvedIssues,
    criticalIssues,
    totalAssets,
    recentIssues,
    issuesByCategory,
    newThisWeek,
    resolvedThisWeek,
    newToday,
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
    prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: weekAgo } } }),
    prisma.issue.count({ where: { organizationId: orgId, status: { in: ["RESOLVED", "CLOSED"] }, updatedAt: { gte: weekAgo } } }),
    prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: todayStart } } }),
  ])

  return {
    totalIssues, openIssues, escalatedIssues, resolvedIssues, criticalIssues,
    totalAssets, recentIssues, issuesByCategory, newThisWeek, resolvedThisWeek, newToday,
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
  const ageDays = (Date.now() - new Date(org.createdAt).getTime()) / (1000 * 60 * 60 * 24)
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
      { label: "Add your first location",       description: "Add a site, building, or floor.", done: locations > 0,    href: "/locations" },
      { label: "Invite your first team member", description: "Add colleagues so they can submit issues.", done: users > 1, href: "/team" },
      { label: "Submit your first issue",       description: "Report a problem, request, or task.", done: issues > 0,   href: "/issues/new" },
      { label: "Set up routing rules",          description: "Auto-assign issues by category and location.", done: routingRules > 0, href: "/settings/routing" },
      { label: "Configure your first QR code", description: "Link a QR code to a location.", done: qrCodes > 0,        href: "/qr-codes" },
    ],
  }
}

// ── Health score helpers ───────────────────────────────────────────────────
function computeHealthScore(openIssues: number, criticalIssues: number, escalatedIssues: number, resolvedThisWeek: number): number {
  let score = 100
  score -= Math.min(openIssues, 20)
  score -= Math.min(criticalIssues * 5, 25)
  score -= Math.min(escalatedIssues * 3, 15)
  score += Math.min(resolvedThisWeek, 10)
  return Math.max(0, Math.min(100, score))
}

function getHealthInfo(score: number) {
  if (score >= 90) return {
    label: "EXCELLENT",
    text: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    gradient: "linear-gradient(135deg, rgba(240,253,244,0.9) 0%, rgba(167,243,208,0.25) 100%)",
    borderColor: "#a7f3d0",
  }
  if (score >= 80) return {
    label: "GOOD",
    text: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    gradient: "linear-gradient(135deg, rgba(239,246,255,0.9) 0%, rgba(191,219,254,0.25) 100%)",
    borderColor: "#bfdbfe",
  }
  if (score >= 60) return {
    label: "FAIR",
    text: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    gradient: "linear-gradient(135deg, rgba(255,251,235,0.9) 0%, rgba(252,211,77,0.2) 100%)",
    borderColor: "#fde68a",
  }
  return {
    label: "CRITICAL",
    text: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    gradient: "linear-gradient(135deg, rgba(255,241,242,0.9) 0%, rgba(254,202,202,0.3) 100%)",
    borderColor: "#fecaca",
  }
}

function getAiInsight(d: { openIssues: number; criticalIssues: number; escalatedIssues: number; resolvedThisWeek: number; newThisWeek: number }) {
  if (d.criticalIssues > 0) return {
    insight: `${d.criticalIssues} critical issue${d.criticalIssues > 1 ? "s" : ""} active — immediate attention required`,
    recommendation: `Address ${d.criticalIssues > 1 ? "these" : "this"} critical issue${d.criticalIssues > 1 ? "s" : ""} before shift end to prevent further escalation`,
  }
  if (d.escalatedIssues > 0) return {
    insight: `${d.escalatedIssues} escalated issue${d.escalatedIssues > 1 ? "s" : ""} awaiting resolution — response time monitoring active`,
    recommendation: "Update stakeholders on escalation status and set clear resolution targets",
  }
  if (d.openIssues > 10) return {
    insight: `${d.openIssues} open issues pending — queue above normal levels`,
    recommendation: "Consider batch-assigning open items to reduce backlog and improve response time",
  }
  if (d.resolvedThisWeek > 0) return {
    insight: `${d.resolvedThisWeek} issue${d.resolvedThisWeek > 1 ? "s" : ""} resolved this week — operations on track`,
    recommendation: "Continue current response protocols and review SOPs for efficiency gains",
  }
  return {
    insight: "No active issues — operations running smoothly",
    recommendation: "Use downtime to review SOPs and ensure team preparedness",
  }
}

function generateAiInsights(d: {
  issuesByCategory: Array<{ category: string; _count: { id: number } }>
  newThisWeek: number
  resolvedThisWeek: number
  criticalIssues: number
  escalatedIssues: number
  totalIssues: number
}): string[] {
  if (d.totalIssues === 0) return []
  const out: string[] = []

  if (d.issuesByCategory.length > 0) {
    const top = d.issuesByCategory[0]
    const lbl = ISSUE_CATEGORY[top.category as keyof typeof ISSUE_CATEGORY] ?? top.category
    if (top._count.id > 1) out.push(`${lbl} is your top reported issue type — ${top._count.id} cases`)
  }

  if (d.resolvedThisWeek > 0 || d.newThisWeek > 0) {
    if (d.resolvedThisWeek >= d.newThisWeek && d.resolvedThisWeek > 0) {
      out.push(`Team is keeping pace — ${d.resolvedThisWeek} resolved vs ${d.newThisWeek} opened this week`)
    } else if (d.newThisWeek > d.resolvedThisWeek) {
      out.push(`${d.newThisWeek} new issues opened this week, ${d.resolvedThisWeek} resolved — backlog growing`)
    } else if (d.newThisWeek > 0) {
      out.push(`${d.newThisWeek} new issue${d.newThisWeek > 1 ? "s" : ""} reported this week`)
    }
  }

  if (d.criticalIssues >= 2) {
    out.push(`${d.criticalIssues} critical issues unresolved — prioritize before next shift`)
  } else if (d.escalatedIssues > 0) {
    out.push(`${d.escalatedIssues} escalated issue${d.escalatedIssues > 1 ? "s" : ""} awaiting resolution`)
  } else if (d.criticalIssues === 0 && d.resolvedThisWeek > 0) {
    out.push("No critical issues — maintain current response standards")
  }

  return out.slice(0, 3)
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
  const aiInsights = generateAiInsights(data)

  const trend = data.resolvedThisWeek > data.newThisWeek
    ? { icon: "↗", label: "Improving",       cls: "text-emerald-600" }
    : data.newThisWeek > data.resolvedThisWeek
    ? { icon: "↘", label: "Under Pressure",  cls: "text-amber-600" }
    : { icon: "→",  label: "Stable",          cls: "text-gray-400" }

  const headerSubtitle = [
    data.openIssues > 0      && `${data.openIssues} open`,
    data.criticalIssues > 0  && `${data.criticalIssues} critical`,
    data.escalatedIssues > 0 && `${data.escalatedIssues} escalated`,
    data.resolvedThisWeek > 0 && `${data.resolvedThisWeek} resolved this week`,
  ].filter(Boolean).join(" · ")

  // Subtle semantic background tints per KPI card (5% opacity of semantic color)
  const stats = [
    {
      label: "Open Issues",
      value: data.openIssues,
      icon: AlertCircle,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-100",
      accentBorder: "border-l-blue-500",
      bgTint: "rgba(59,130,246,0.05)",
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
      bgTint: "rgba(239,68,68,0.05)",
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
      bgTint: "rgba(245,158,11,0.05)",
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
      bgTint: "rgba(16,185,129,0.05)",
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
      bgTint: "rgba(139,92,246,0.05)",
      href: "/assets",
      secondary: "Tracked",
      secondaryColor: "text-gray-400",
      trend: null,
    },
    {
      label: "Total Issues",
      value: data.totalIssues,
      icon: TrendingUp,
      iconColor: "text-slate-500",
      iconBg: "bg-slate-100",
      accentBorder: "border-l-slate-400",
      bgTint: "rgba(100,116,139,0.05)",
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
        <h1 className="text-lg font-bold text-gray-900">{greeting}, {firstName} 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">Here&apos;s what&apos;s happening</p>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-4 space-y-3">
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

        {/* ── Operations Health (hero card) ─────────────────────────────── */}
        <div
          className="hidden md:block rounded-2xl border shadow-[0_4px_24px_rgba(0,0,0,0.07)] overflow-hidden"
          style={{ background: healthInfo.gradient, borderColor: healthInfo.borderColor }}
        >
          <div className="px-8 py-6">
            {/* Top row */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Operations Health</p>
              <div className={`flex items-center gap-1.5 text-sm font-bold ${trend.cls}`}>
                <span className="text-base">{trend.icon}</span>
                {trend.label}
              </div>
            </div>

            {/* Score row */}
            <div className="flex items-end gap-6 mb-5">
              <div className={`text-[88px] font-black leading-none ${healthInfo.text}`}
                style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>
                {healthScore}
              </div>
              <div className="pb-2 flex flex-col gap-2">
                <span className={`inline-flex items-center text-sm font-black px-3 py-1.5 rounded-full border ${healthInfo.bg} ${healthInfo.text} ${healthInfo.border}`}>
                  {healthInfo.label}
                </span>
                <span className="text-xs text-gray-400 font-medium">out of 100</span>
              </div>
              {/* Stat pills */}
              <div className="ml-auto pb-2 flex items-center gap-3 flex-wrap">
                {data.criticalIssues > 0 && (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-xs font-semibold text-red-700">{data.criticalIssues} Critical</span>
                  </div>
                )}
                {data.escalatedIssues > 0 && (
                  <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-full px-3 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    <span className="text-xs font-semibold text-orange-700">{data.escalatedIssues} Escalated</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 bg-white/70 border border-gray-200 rounded-full px-3 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-xs font-medium text-gray-600">{data.openIssues} Open</span>
                </div>
                {data.resolvedThisWeek > 0 && (
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium text-emerald-700">{data.resolvedThisWeek} Resolved / wk</span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Recommendation callout */}
            <div className="bg-white/65 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/80">
              <div className="flex items-start gap-2.5">
                <Bot className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-0.5">AI Recommendation</p>
                  <p className="text-sm font-semibold text-gray-800">{aiInsight.recommendation}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Today's Priorities (compact briefing strip) ───────────────── */}
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-5 px-5 py-3">
            <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase shrink-0">Today&apos;s Priorities</p>
            <div className="h-6 w-px bg-gray-100 shrink-0" />
            <div className="flex items-center gap-4 flex-wrap">
              {data.criticalIssues > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-sm font-semibold text-red-600">{data.criticalIssues} Critical</span>
                </div>
              )}
              {data.escalatedIssues > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  <span className="text-sm font-semibold text-orange-600">{data.escalatedIssues} Escalated</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span className="text-sm text-gray-600">{data.newToday} new today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                <span className="text-sm text-gray-500">{data.openIssues} open</span>
              </div>
            </div>
            {aiInsight.recommendation && (
              <>
                <div className="h-6 w-px bg-gray-100 shrink-0" />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Bot className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-[12px] text-gray-500 truncate">
                    <span className="font-semibold text-gray-700">AI: </span>
                    {aiInsight.recommendation}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
        <div data-tour="kpi-cards" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map(({ label, value, icon: Icon, iconColor, iconBg, accentBorder, bgTint, href, secondary, secondaryColor, trend: kpiTrend }) => (
            <Link
              key={label}
              href={href}
              className={`rounded-xl border border-gray-200 border-l-4 ${accentBorder} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150`}
              style={{ background: `linear-gradient(135deg, ${bgTint} 0%, white 60%)` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 ${iconBg} rounded-full flex items-center justify-center`}>
                  <Icon className={`w-[18px] h-[18px] ${iconColor}`} />
                </div>
                {kpiTrend && (
                  <span className={`text-xs font-bold ${kpiTrend.cls}`}>
                    {kpiTrend.sign}{kpiTrend.val !== null ? ` ${kpiTrend.val}` : ""}
                  </span>
                )}
              </div>
              <div className="text-3xl font-black text-gray-900 leading-none">{value}</div>
              <div className="text-[13px] font-medium text-gray-500 mt-1">{label}</div>
              <div className={`text-[11px] mt-1.5 ${secondaryColor}`}>{secondary}</div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                      className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors"
                    >
                      <div className="shrink-0 pt-[7px]">
                        <div className={`w-2 h-2 rounded-full ${dot}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-gray-900 truncate max-w-[240px]">{issue.title}</span>
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
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{issue.location.name}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        {assigneeInitial && (
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-indigo-700">{assigneeInitial}</span>
                          </div>
                        )}
                        {waiting && (
                          <span className={`text-[11px] whitespace-nowrap ${waiting.cls}`}>{waiting.label}</span>
                        )}
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
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
                          <span className="text-[13px] font-medium text-gray-700 truncate max-w-[130px]">{label}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold text-gray-500">{pct}%</span>
                            <span className="text-[13px] font-bold text-gray-900 w-5 text-right">{item._count.id}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div
                            className={`${barColor} h-2.5 rounded-full transition-all`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* ── Relay AI card (replaces Suggestions) ───────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="font-bold text-gray-900">Relay AI</h2>
              </div>

              <div className="px-5 py-4">
                <p className="text-[12px] text-gray-400 font-medium mb-3">
                  {greeting}, {firstName}. Here is your operational summary.
                </p>

                {data.totalIssues === 0 ? (
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Relay AI is analyzing your operational data. Insights will appear as your team logs activity.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {aiInsights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-blue-500 mt-2 shrink-0" />
                        <p className="text-sm text-gray-700 leading-snug">{insight}</p>
                      </li>
                    ))}
                    {aiInsights.length === 0 && (
                      <p className="text-sm text-gray-400 leading-relaxed">
                        Not enough data for insights yet. Log more activity to get started.
                      </p>
                    )}
                  </ul>
                )}

                <Link
                  href="/executive-briefings"
                  className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Read Full Brief <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

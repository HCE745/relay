import { Header } from "@/components/layout/header"
import { getDisplaySession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { WelcomeChecklist } from "@/components/dashboard/welcome-checklist"
import { ReferralCard } from "@/components/dashboard/referral-card"
import { OnboardingTip } from "@/components/dashboard/onboarding-tip"
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
  Sparkles,
  Cpu,
  Shield,
  Wrench,
  Building2,
  QrCode,
  Droplets,
  MessageSquare,
  UserX,
  Home,
} from "lucide-react"
import { CARWASH_ASSET_TAXONOMY } from "@/lib/car-wash-config"
import { PM_ASSET_TAXONOMY } from "@/lib/property-management-config"
import { Badge } from "@/components/ui/badge"
import { PRIORITY_COLOR, STATUS_COLOR, ISSUE_STATUS, ISSUE_PRIORITY, ISSUE_CATEGORY } from "@/lib/constants"
import { formatDistanceToNow } from "date-fns"

// Hex colors for chart bars (inline styles — Tailwind purges dynamic classes)
const CATEGORY_COLOR_HEX: Record<string, string> = {
  INJURY:              "#ef4444",
  SAFETY:              "#ef4444",
  EQUIPMENT_BREAKDOWN: "#f97316",
  MAINTENANCE:         "#f59e0b",
  SUPPLY_SHORTAGE:     "#eab308",
  CUSTOMER_COMPLAINT:  "#a855f7",
  FACILITY:            "#3b82f6",
  VEHICLE:             "#06b6d4",
  EMPLOYEE:            "#6366f1",
  GENERAL:             "#94a3b8",
}

// Category icon placeholder bg/color for issue thumbnails
const CATEGORY_ICON_BG: Record<string, string> = {
  INJURY:              "bg-red-50",
  SAFETY:              "bg-red-50",
  EQUIPMENT_BREAKDOWN: "bg-orange-50",
  MAINTENANCE:         "bg-amber-50",
  SUPPLY_SHORTAGE:     "bg-yellow-50",
  CUSTOMER_COMPLAINT:  "bg-purple-50",
  FACILITY:            "bg-blue-50",
  VEHICLE:             "bg-cyan-50",
  EMPLOYEE:            "bg-indigo-50",
  GENERAL:             "bg-slate-100",
}
const CATEGORY_ICON_CLR: Record<string, string> = {
  INJURY:              "text-red-500",
  SAFETY:              "text-red-500",
  EQUIPMENT_BREAKDOWN: "text-orange-500",
  MAINTENANCE:         "text-amber-500",
  SUPPLY_SHORTAGE:     "text-yellow-500",
  CUSTOMER_COMPLAINT:  "text-purple-500",
  FACILITY:            "text-blue-500",
  VEHICLE:             "text-cyan-500",
  EMPLOYEE:            "text-indigo-500",
  GENERAL:             "text-slate-400",
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
    openIssuesByCategory,
    newThisWeek,
    resolvedThisWeek,
    newToday,
    resolvedToday,
    orgRow,
    customerReportsToday,
    openEquipmentIssues,
    operationalAssets,
    openMaintenanceIssues,
    repeatFailureCount,
    recentCustomerReports,
    recentEquipmentAssetsRaw,
    highPriorityIssues,
    tenantRequestsToday,
    unassignedIssues,
    propertiesWithOpenIssuesRaw,
    recentTenantRequests,
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
        location:   { select: { name: true } },
        assignedTo: { select: { name: true } },
        attachments: { where: { mimeType: { startsWith: "image/" } }, select: { url: true }, take: 1 },
      },
    }),
    prisma.issue.groupBy({
      by: ["category"],
      where: { organizationId: orgId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    // Active (non-resolved) issues by category — used for contributor sub-scores
    prisma.issue.groupBy({
      by: ["category"],
      where: { organizationId: orgId, status: { notIn: ["RESOLVED", "CLOSED"] } },
      _count: { id: true },
    }),
    prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: weekAgo } } }),
    prisma.issue.count({ where: { organizationId: orgId, status: { in: ["RESOLVED", "CLOSED"] }, updatedAt: { gte: weekAgo } } }),
    prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: todayStart } } }),
    prisma.issue.count({ where: { organizationId: orgId, status: { in: ["RESOLVED", "CLOSED"] }, updatedAt: { gte: todayStart } } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { industry: true } }),
    prisma.issue.count({ where: { organizationId: orgId, category: "CUSTOMER_REPORT", createdAt: { gte: todayStart } } }),
    prisma.issue.count({ where: { organizationId: orgId, category: "EQUIPMENT_BREAKDOWN", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.asset.count({ where: { organizationId: orgId, status: "OPERATIONAL" } }),
    prisma.issue.count({ where: { organizationId: orgId, category: "MAINTENANCE", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.issue.groupBy({
      by: ["assetId"],
      where: { organizationId: orgId, category: "EQUIPMENT_BREAKDOWN", status: { notIn: ["RESOLVED", "CLOSED"] }, assetId: { not: null } },
      _count: { id: true },
    }).then(groups => groups.filter(g => g._count.id > 1).length),
    prisma.issue.findMany({
      where: { organizationId: orgId, category: "CUSTOMER_REPORT" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { location: { select: { name: true } } },
    }),
    prisma.asset.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true, name: true, status: true, assetSubtype: true,
        location: { select: { name: true } },
        issues: { where: { status: { notIn: ["RESOLVED", "CLOSED"] } }, select: { id: true, category: true } },
      },
    }),
    // PM-specific counts
    prisma.issue.count({ where: { organizationId: orgId, priority: { in: ["CRITICAL", "HIGH"] }, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.issue.count({ where: { organizationId: orgId, category: "TENANT_REQUEST", createdAt: { gte: todayStart } } }),
    prisma.issue.count({ where: { organizationId: orgId, assignedToId: null, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.issue.findMany({ where: { organizationId: orgId, status: { notIn: ["RESOLVED", "CLOSED"] }, locationId: { not: null } }, select: { locationId: true }, distinct: ["locationId"] }),
    prisma.issue.findMany({
      where: { organizationId: orgId, category: "TENANT_REQUEST" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { location: { select: { name: true } }, assignedTo: { select: { name: true } } },
    }),
  ])

  const STATUS_PRIORITY: Record<string, number> = { MAINTENANCE: 0, OUT_OF_SERVICE: 1, INACTIVE: 2, OPERATIONAL: 3 }
  const sortedEquipmentAssets = [...recentEquipmentAssetsRaw].sort((a, b) => {
    const aHasIssues = a.issues.length > 0 ? 0 : 1
    const bHasIssues = b.issues.length > 0 ? 0 : 1
    if (aHasIssues !== bHasIssues) return aHasIssues - bHasIssues
    return (STATUS_PRIORITY[a.status] ?? 4) - (STATUS_PRIORITY[b.status] ?? 4)
  }).slice(0, 8)

  return {
    totalIssues, openIssues, escalatedIssues, resolvedIssues, criticalIssues,
    totalAssets, recentIssues, issuesByCategory, openIssuesByCategory,
    newThisWeek, resolvedThisWeek, newToday, resolvedToday,
    industry: orgRow?.industry ?? null,
    customerReportsToday, openEquipmentIssues, operationalAssets,
    openMaintenanceIssues, repeatFailureCount, recentCustomerReports,
    equipmentAssets: sortedEquipmentAssets,
    highPriorityIssues, tenantRequestsToday, unassignedIssues,
    propertiesWithOpenIssues: propertiesWithOpenIssuesRaw.length,
    recentTenantRequests,
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

// ── Health score helpers ────────────────────────────────────────────────────
function computeHealthScore(openIssues: number, criticalIssues: number, escalatedIssues: number, resolvedThisWeek: number): number {
  let score = 100
  score -= Math.min(openIssues, 20)
  score -= Math.min(criticalIssues * 5, 25)
  score -= Math.min(escalatedIssues * 3, 15)
  score += Math.min(resolvedThisWeek, 10)
  return Math.max(0, Math.min(100, score))
}

function computeSubScore(openCount: number, severity: number): number {
  return Math.max(0, Math.min(100, 100 - openCount * severity))
}

function contributorColor(score: number): { text: string; dot: string } {
  if (score >= 85) return { text: "text-emerald-600", dot: "bg-emerald-400" }
  if (score >= 70) return { text: "text-blue-600",    dot: "bg-blue-400" }
  if (score >= 50) return { text: "text-amber-600",   dot: "bg-amber-400" }
  return { text: "text-red-600", dot: "bg-red-500" }
}

function getHealthInfo(score: number) {
  if (score >= 90) return {
    label: "EXCELLENT", text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200",
    gradient: "linear-gradient(135deg, rgba(240,253,244,0.9) 0%, rgba(167,243,208,0.25) 100%)",
    borderColor: "#a7f3d0",
  }
  if (score >= 80) return {
    label: "GOOD", text: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200",
    gradient: "linear-gradient(135deg, rgba(239,246,255,0.9) 0%, rgba(191,219,254,0.25) 100%)",
    borderColor: "#bfdbfe",
  }
  if (score >= 60) return {
    label: "FAIR", text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200",
    gradient: "linear-gradient(135deg, rgba(255,251,235,0.9) 0%, rgba(252,211,77,0.2) 100%)",
    borderColor: "#fde68a",
  }
  return {
    label: "CRITICAL", text: "text-red-600", bg: "bg-red-50", border: "border-red-200",
    gradient: "linear-gradient(135deg, rgba(255,241,242,0.9) 0%, rgba(254,202,202,0.3) 100%)",
    borderColor: "#fecaca",
  }
}

function generateAiInsights(d: {
  issuesByCategory: Array<{ category: string; _count: { id: number } }>
  newThisWeek: number
  resolvedThisWeek: number
  criticalIssues: number
  escalatedIssues: number
  totalIssues: number
  openIssues: number
  newToday: number
}): string[] {
  if (d.totalIssues === 0) return []
  const out: string[] = []

  if (d.issuesByCategory.length > 0) {
    const top = d.issuesByCategory[0]
    const pct = Math.round((top._count.id / d.totalIssues) * 100)
    const lbl = ISSUE_CATEGORY[top.category as keyof typeof ISSUE_CATEGORY] ?? top.category
    if (pct >= 35) {
      out.push(`${lbl} is driving ${pct}% of your issues — a dedicated resolution workflow could clear the backlog`)
    } else if (top._count.id >= 3) {
      out.push(`${lbl} is your highest-volume category with ${top._count.id} cases (${pct}% of all issues)`)
    }
  }

  const net = d.resolvedThisWeek - d.newThisWeek
  if (net > 2) {
    out.push(`Your team is outpacing incoming issues — ${d.resolvedThisWeek} resolved vs ${d.newThisWeek} opened this week`)
  } else if (net < -2) {
    out.push(`Backlog is growing: ${d.newThisWeek} opened vs ${d.resolvedThisWeek} resolved this week (+${Math.abs(net)} net)`)
  } else if (d.resolvedThisWeek > 0) {
    out.push(`Resolution pace is stable — ${d.resolvedThisWeek} resolved vs ${d.newThisWeek} opened this week`)
  } else if (d.newThisWeek > 0) {
    out.push(`${d.newThisWeek} new issue${d.newThisWeek > 1 ? "s" : ""} reported this week — none resolved yet`)
  }

  if (d.criticalIssues >= 2) {
    out.push(`${d.criticalIssues} critical issues unresolved — prioritize before next shift to prevent escalation`)
  } else if (d.criticalIssues === 1 && d.escalatedIssues > 0) {
    out.push(`1 critical + ${d.escalatedIssues} escalated issue${d.escalatedIssues > 1 ? "s" : ""} need immediate attention`)
  } else if (d.escalatedIssues > 0) {
    out.push(`${d.escalatedIssues} escalated issue${d.escalatedIssues > 1 ? "s" : ""} pending — update stakeholders on resolution targets`)
  } else if (d.criticalIssues === 1) {
    out.push("1 critical issue active — resolve before shift end to protect the health score")
  } else if (d.openIssues === 0) {
    out.push("All issues resolved — excellent operational standing")
  } else if (d.newToday === 0 && d.openIssues > 0) {
    out.push(`No new issues today — focus on clearing the ${d.openIssues} in the backlog`)
  }

  return out.filter(Boolean).slice(0, 3)
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

  const isCarWash = data.industry === "Car Wash"
  const isPropertyMgmt = data.industry === "Property Management"

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const firstName = session?.displayName?.split(" ")[0] ?? "there"

  const healthScore = computeHealthScore(data.openIssues, data.criticalIssues, data.escalatedIssues, data.resolvedThisWeek)
  const healthInfo = getHealthInfo(healthScore)
  const aiInsights = generateAiInsights(data)

  // Yesterday score approximation for trend delta
  const yesterdayOpenApprox = Math.max(0, data.openIssues + data.resolvedToday - data.newToday)
  const yesterdayScore = computeHealthScore(
    yesterdayOpenApprox,
    data.criticalIssues,
    data.escalatedIssues,
    Math.max(0, data.resolvedThisWeek - data.resolvedToday),
  )
  const scoreDelta = healthScore - yesterdayScore

  // AI confidence based on data volume
  const aiConfidence = data.totalIssues >= 20 ? "High" : data.totalIssues >= 5 ? "Medium" : "Low"
  const aiConfidenceColor = data.totalIssues >= 20 ? "text-emerald-600" : data.totalIssues >= 5 ? "text-amber-500" : "text-gray-400"
  const aiConfidenceDot = data.totalIssues >= 20 ? "bg-emerald-400" : data.totalIssues >= 5 ? "bg-amber-400" : "bg-gray-300"

  // Contributor sub-scores
  const catCounts: Record<string, number> = {}
  for (const row of data.openIssuesByCategory) {
    catCounts[row.category] = row._count.id
  }
  const sumCats = (cats: string[]) => cats.reduce((s, c) => s + (catCounts[c] ?? 0), 0)

  const contributors = [
    { key: "equipment",   label: "Equipment",   icon: Cpu,      open: sumCats(["EQUIPMENT_BREAKDOWN", "VEHICLE"]),                                               severity: 6  },
    { key: "safety",      label: "Safety",      icon: Shield,   open: sumCats(["SAFETY", "INJURY"]),                                                              severity: 10 },
    { key: "maintenance", label: "Maintenance", icon: Wrench,   open: sumCats(["MAINTENANCE"]),                                                                    severity: 5  },
    { key: "facilities",  label: "Facilities",  icon: Building2, open: sumCats(["FACILITY", "GENERAL", "SUPPLY_SHORTAGE", "CUSTOMER_COMPLAINT", "EMPLOYEE"]),      severity: 4  },
  ].map(c => ({ ...c, score: computeSubScore(c.open, c.severity) }))

  const headerSubtitle = [
    data.openIssues > 0       && `${data.openIssues} open`,
    data.criticalIssues > 0   && `${data.criticalIssues} critical`,
    data.escalatedIssues > 0  && `${data.escalatedIssues} escalated`,
    data.resolvedThisWeek > 0 && `${data.resolvedThisWeek} resolved this week`,
  ].filter(Boolean).join(" · ")

  const stats = [
    {
      label: "Open Issues", value: data.openIssues, icon: AlertCircle,
      iconColor: "text-blue-600", iconBg: "bg-blue-100", accentBorder: "border-l-blue-500",
      bgTint: "rgba(59,130,246,0.05)", href: "/issues?status=OPEN",
      secondary: data.newThisWeek > 0 ? `${data.newThisWeek} new this week` : "No new this week",
      secondaryColor: data.newThisWeek > 0 ? "text-amber-600" : "text-gray-400",
      trend: data.newThisWeek > 0 ? { sign: "▲", val: data.newThisWeek, cls: "text-amber-500" } : null,
    },
    {
      label: "Critical", value: data.criticalIssues, icon: AlertTriangle,
      iconColor: "text-red-600", iconBg: "bg-red-100", accentBorder: "border-l-red-500",
      bgTint: "rgba(239,68,68,0.05)", href: "/issues?priority=CRITICAL",
      secondary: "Highest priority", secondaryColor: "text-gray-400",
      trend: data.criticalIssues > 0 ? { sign: "!", val: null, cls: "text-red-500" } : null,
    },
    {
      label: "Escalated", value: data.escalatedIssues, icon: ChevronUp,
      iconColor: "text-orange-600", iconBg: "bg-orange-100", accentBorder: "border-l-orange-500",
      bgTint: "rgba(245,158,11,0.05)", href: "/issues?status=ESCALATED",
      secondary: "Requires response", secondaryColor: "text-gray-400", trend: null,
    },
    {
      label: "Resolved", value: data.resolvedIssues, icon: CheckCircle2,
      iconColor: "text-emerald-600", iconBg: "bg-emerald-100", accentBorder: "border-l-emerald-500",
      bgTint: "rgba(16,185,129,0.05)", href: "/issues?status=RESOLVED",
      secondary: data.resolvedThisWeek > 0 ? `${data.resolvedThisWeek} this week` : "None this week",
      secondaryColor: data.resolvedThisWeek > 0 ? "text-emerald-600" : "text-gray-400",
      trend: data.resolvedThisWeek > 0 ? { sign: "▲", val: data.resolvedThisWeek, cls: "text-emerald-500" } : null,
    },
    {
      label: "Total Assets", value: data.totalAssets, icon: Package,
      iconColor: "text-violet-600", iconBg: "bg-violet-100", accentBorder: "border-l-violet-500",
      bgTint: "rgba(139,92,246,0.05)", href: "/assets",
      secondary: "Tracked", secondaryColor: "text-gray-400", trend: null,
    },
    {
      label: "Total Issues", value: data.totalIssues, icon: TrendingUp,
      iconColor: "text-slate-500", iconBg: "bg-slate-100", accentBorder: "border-l-slate-400",
      bgTint: "rgba(100,116,139,0.05)", href: "/issues",
      secondary: data.newThisWeek > 0 ? `${data.newThisWeek} added this week` : "None this week",
      secondaryColor: "text-gray-400", trend: null,
    },
  ]

  return (
    <div>
      <Header title={`${greeting}, ${firstName} 👋`} subtitle={headerSubtitle || undefined} />

      {/* Mobile greeting */}
      <div className="md:hidden px-4 pt-4 pb-1">
        <h1 className="text-lg font-bold text-gray-900">{greeting}, {firstName} 👋</h1>
        <p className="text-sm text-gray-400 mt-0.5">Here&apos;s what&apos;s happening</p>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-4 space-y-3 md:space-y-4">
        {checklist && checklist.items.filter(i => !i.done).length > 0 && !session?.isDemo && (
          <WelcomeChecklist items={checklist.items} orgName={checklist.orgName} />
        )}
        {checklist && !session?.isDemo && <OnboardingTip />}
        {referralCard && (
          <ReferralCard
            referralCode={referralCard.referralCode}
            referralLink={referralCard.referralLink}
            cardTitle={referralCard.cardTitle}
            cardDescription={referralCard.cardDescription}
            stats={referralCard.stats}
          />
        )}

        {/* ── Operations Health Score ───────────────────────────────────── */}
        <div
          className="rounded-2xl border shadow-[0_4px_24px_rgba(0,0,0,0.07)] overflow-hidden"
          style={{ background: healthInfo.gradient, borderColor: healthInfo.borderColor }}
        >
          <div className="px-5 md:px-8 py-5 md:py-6">
            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Operations Health</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">AI Confidence:</span>
                <div className={`w-1.5 h-1.5 rounded-full ${aiConfidenceDot} shrink-0`} />
                <span className={`text-[11px] font-bold ${aiConfidenceColor}`}>{aiConfidence}</span>
              </div>
            </div>

            {/* Score + status + trend */}
            <div className="flex items-end gap-4 md:gap-6 mb-5">
              <div
                className={`text-[64px] md:text-[88px] font-black leading-none ${healthInfo.text}`}
                style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}
              >
                {healthScore}
              </div>
              <div className="pb-1.5 flex flex-col gap-2">
                <span className={`inline-flex items-center text-sm font-black px-3 py-1.5 rounded-full border ${healthInfo.bg} ${healthInfo.text} ${healthInfo.border}`}>
                  {healthInfo.label}
                </span>
                <div className={`flex items-center gap-1 text-sm font-semibold ${
                  scoreDelta > 0 ? "text-emerald-600" : scoreDelta < 0 ? "text-red-500" : "text-gray-400"
                }`}>
                  <span>{scoreDelta > 0 ? "↗" : scoreDelta < 0 ? "↘" : "→"}</span>
                  <span>
                    {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta < 0 ? `${scoreDelta}` : "Same"} from yesterday
                  </span>
                </div>
              </div>
              {/* Stat pills — desktop only */}
              <div className="ml-auto pb-1.5 hidden md:flex items-center gap-3 flex-wrap">
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
                    <span className="text-xs font-medium text-emerald-700">{data.resolvedThisWeek} Resolved/wk</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contributors breakdown — 2-col on mobile, 4-col on desktop */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
              {contributors.map((c) => {
                const clr = contributorColor(c.score)
                const CIcon = c.icon
                return (
                  <div key={c.key} className="bg-white/65 backdrop-blur-sm rounded-xl px-3 md:px-4 py-3 border border-white/80">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CIcon className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{c.label}</span>
                    </div>
                    <div className={`text-2xl md:text-3xl font-black leading-none ${clr.text}`}>{c.score}</div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className={`w-1 h-1 rounded-full ${clr.dot}`} />
                      <span className="text-[11px] text-gray-400">
                        {c.open === 0 ? "No issues" : `${c.open} active`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Today's Priorities (2/3) + Relay AI (1/3) — desktop only ──── */}
        <div className="hidden md:grid grid-cols-3 gap-4">
          {/* Today's Priorities */}
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Today&apos;s Priorities</p>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <Link
                href="/issues?priority=CRITICAL"
                className={`flex items-start gap-3 rounded-lg px-3.5 py-3 border hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 ${
                  data.criticalIssues > 0 ? "bg-red-50/70 border-red-100 hover:bg-red-50" : "bg-gray-50/50 border-gray-100"
                }`}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${data.criticalIssues > 0 ? "bg-red-500" : "bg-gray-300"}`} />
                <div>
                  <div className={`text-2xl font-black ${data.criticalIssues > 0 ? "text-red-600" : "text-gray-400"}`}>{data.criticalIssues}</div>
                  <div className={`text-[12px] font-medium mt-0.5 ${data.criticalIssues > 0 ? "text-red-500" : "text-gray-400"}`}>Critical Issues</div>
                </div>
              </Link>
              <Link
                href="/issues?status=ESCALATED"
                className={`flex items-start gap-3 rounded-lg px-3.5 py-3 border hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 ${
                  data.escalatedIssues > 0 ? "bg-orange-50/70 border-orange-100 hover:bg-orange-50" : "bg-gray-50/50 border-gray-100"
                }`}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${data.escalatedIssues > 0 ? "bg-orange-500" : "bg-gray-300"}`} />
                <div>
                  <div className={`text-2xl font-black ${data.escalatedIssues > 0 ? "text-orange-600" : "text-gray-400"}`}>{data.escalatedIssues}</div>
                  <div className={`text-[12px] font-medium mt-0.5 ${data.escalatedIssues > 0 ? "text-orange-500" : "text-gray-400"}`}>Escalated</div>
                </div>
              </Link>
              <Link
                href="/issues?status=OPEN"
                className="flex items-start gap-3 rounded-lg px-3.5 py-3 bg-blue-50/70 border border-blue-100 hover:bg-blue-50 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150"
              >
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div>
                  <div className="text-2xl font-black text-blue-600">{data.newToday}</div>
                  <div className="text-[12px] font-medium text-blue-500 mt-0.5">New Today</div>
                </div>
              </Link>
              <Link
                href="/issues?status=OPEN"
                className="flex items-start gap-3 rounded-lg px-3.5 py-3 bg-gray-50 border border-gray-100 hover:bg-gray-100/70 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150"
              >
                <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 shrink-0" />
                <div>
                  <div className="text-2xl font-black text-gray-600">{data.openIssues}</div>
                  <div className="text-[12px] font-medium text-gray-400 mt-0.5">Open Issues</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Relay AI */}
          <div className="col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100">
              <div className="relative w-7 h-7 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
              </div>
              <h2 className="font-bold text-gray-900">Relay AI</h2>
            </div>

            <div className="px-5 py-4">
              {data.totalIssues === 0 ? (
                <p className="text-sm text-gray-400 leading-relaxed">
                  Relay AI is analyzing your operational data. Insights appear as your team logs activity.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {aiInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-blue-500 mt-2 shrink-0" />
                      <p className="text-sm text-gray-600 leading-snug">{insight}</p>
                    </li>
                  ))}
                  {aiInsights.length === 0 && (
                    <p className="text-sm text-gray-400 leading-relaxed">Log more activity to unlock AI-powered insights.</p>
                  )}
                </ul>
              )}
              <Link
                href="/executive-briefings"
                className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Read Full Analysis <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Car Wash Dashboard / Generic KPI + Charts ─────────────────── */}
        {isCarWash ? (
          <>
            {/* Car Wash KPI Cards */}
            <div data-tour="kpi-cards" className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                {
                  label: "Bays Operational", href: "/assets",
                  iconEl: <Droplets className="w-[18px] h-[18px] text-emerald-600" />,
                  iconBg: "bg-emerald-100", accentBorder: "border-l-emerald-500", bgTint: "rgba(16,185,129,0.05)",
                  value: <>{data.operationalAssets}<span className="text-lg text-gray-400 font-bold ml-0.5">/{data.totalAssets}</span></>,
                  secondary: "Currently operational", secondaryColor: "text-gray-400",
                },
                {
                  label: "Equipment Down", href: "/issues?category=EQUIPMENT_BREAKDOWN&status=OPEN",
                  iconEl: <Wrench className={`w-[18px] h-[18px] ${data.openEquipmentIssues > 0 ? "text-orange-600" : "text-gray-400"}`} />,
                  iconBg: data.openEquipmentIssues > 0 ? "bg-orange-100" : "bg-gray-100",
                  accentBorder: data.openEquipmentIssues > 0 ? "border-l-orange-500" : "border-l-gray-300",
                  bgTint: data.openEquipmentIssues > 0 ? "rgba(249,115,22,0.05)" : "rgba(100,116,139,0.03)",
                  value: <span className={data.openEquipmentIssues > 0 ? "text-orange-600" : ""}>{data.openEquipmentIssues}</span>,
                  secondary: "Open breakdowns", secondaryColor: data.openEquipmentIssues > 0 ? "text-orange-500 font-medium" : "text-gray-400",
                },
                {
                  label: "Customer Reports", href: "/issues?category=CUSTOMER_REPORT",
                  iconEl: <QrCode className="w-[18px] h-[18px] text-purple-600" />,
                  iconBg: "bg-purple-100", accentBorder: "border-l-purple-500", bgTint: "rgba(168,85,247,0.05)",
                  value: <>{data.customerReportsToday}</>,
                  secondary: "Today via QR", secondaryColor: "text-gray-400",
                },
                {
                  label: "Open Maintenance", href: "/issues?category=MAINTENANCE",
                  iconEl: <Wrench className={`w-[18px] h-[18px] ${data.openMaintenanceIssues > 0 ? "text-amber-600" : "text-gray-400"}`} />,
                  iconBg: data.openMaintenanceIssues > 0 ? "bg-amber-100" : "bg-gray-100",
                  accentBorder: data.openMaintenanceIssues > 0 ? "border-l-amber-500" : "border-l-gray-300",
                  bgTint: data.openMaintenanceIssues > 0 ? "rgba(245,158,11,0.05)" : "rgba(100,116,139,0.03)",
                  value: <>{data.openMaintenanceIssues}</>,
                  secondary: "Pending maintenance", secondaryColor: "text-gray-400",
                },
                {
                  label: "Repeat Equipment Issues", href: "/issues?category=EQUIPMENT_BREAKDOWN",
                  iconEl: <AlertTriangle className={`w-[18px] h-[18px] ${data.repeatFailureCount > 0 ? "text-red-600" : "text-gray-400"}`} />,
                  iconBg: data.repeatFailureCount > 0 ? "bg-red-100" : "bg-gray-100",
                  accentBorder: data.repeatFailureCount > 0 ? "border-l-red-500" : "border-l-gray-300",
                  bgTint: data.repeatFailureCount > 0 ? "rgba(239,68,68,0.05)" : "rgba(100,116,139,0.03)",
                  value: <>{data.repeatFailureCount}</>,
                  secondary: "Assets with multiple open", secondaryColor: data.repeatFailureCount > 0 ? "text-red-500 font-medium" : "text-gray-400",
                },
                {
                  label: "Open Issues", href: "/issues?status=OPEN",
                  iconEl: <AlertCircle className="w-[18px] h-[18px] text-blue-600" />,
                  iconBg: "bg-blue-100", accentBorder: "border-l-blue-500", bgTint: "rgba(59,130,246,0.05)",
                  value: <>{data.openIssues}</>,
                  secondary: `${data.newThisWeek} new this week`, secondaryColor: data.newThisWeek > 0 ? "text-amber-600" : "text-gray-400",
                },
              ].map(({ label, href, iconEl, iconBg, accentBorder, bgTint, value, secondary, secondaryColor }) => (
                <Link
                  key={label}
                  href={href}
                  className={`rounded-xl border border-gray-200 border-l-4 ${accentBorder} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150`}
                  style={{ background: `linear-gradient(135deg, ${bgTint} 0%, white 60%)` }}
                >
                  <div className={`w-9 h-9 ${iconBg} rounded-full flex items-center justify-center mb-3`}>
                    {iconEl}
                  </div>
                  <div className="text-3xl font-black text-gray-900 leading-none">{value}</div>
                  <div className="text-[13px] font-medium text-gray-600 mt-1">{label}</div>
                  <div className={`text-[11px] mt-1.5 ${secondaryColor}`}>{secondary}</div>
                </Link>
              ))}
            </div>

            {/* Equipment Status Grid */}
            <div data-tour="carwash-equipment-status" className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Equipment Status</h2>
                <Link href="/assets" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
                  All equipment <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {data.equipmentAssets.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No equipment tracked yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                  {data.equipmentAssets.map((asset) => {
                    const statusConfig = {
                      OPERATIONAL:    { label: "Operational",    bg: "bg-emerald-100", text: "text-emerald-700" },
                      MAINTENANCE:    { label: "Maintenance",    bg: "bg-amber-100",   text: "text-amber-700"   },
                      INACTIVE:       { label: "Inactive",       bg: "bg-gray-100",    text: "text-gray-600"    },
                      OUT_OF_SERVICE: { label: "Out of Service", bg: "bg-red-100",     text: "text-red-700"     },
                    }[asset.status] ?? { label: asset.status, bg: "bg-gray-100", text: "text-gray-600" }
                    const subtypeLabel = asset.assetSubtype
                      ? (CARWASH_ASSET_TAXONOMY[asset.assetSubtype as keyof typeof CARWASH_ASSET_TAXONOMY] ?? asset.assetSubtype)
                      : null
                    const openIssueCount = asset.issues.length

                    return (
                      <Link
                        key={asset.id}
                        href={`/assets/${asset.id}`}
                        className="px-4 py-3.5 hover:bg-gray-50/70 transition-colors flex flex-col gap-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900 leading-tight truncate">{asset.name}</span>
                          {openIssueCount > 0 && (
                            <span className="shrink-0 bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {openIssueCount} issue{openIssueCount > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {subtypeLabel && <span className="text-[11px] text-gray-400">{subtypeLabel}</span>}
                        <span className={`self-start text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                          {statusConfig.label}
                        </span>
                        {asset.location && (
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{asset.location.name}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Recent Customer QR Reports */}
            <div data-tour="carwash-customer-reports" className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Recent Customer Reports</h2>
                <Link href="/issues?category=CUSTOMER_REPORT" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {data.recentCustomerReports.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <QrCode className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No customer reports yet — set up a QR code to start collecting feedback</p>
                  </div>
                ) : (
                  data.recentCustomerReports.map((issue) => (
                    <Link
                      key={issue.id}
                      href={`/issues/${issue.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center border border-purple-100 shrink-0">
                        <QrCode className="w-4 h-4 text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{issue.title}</div>
                        <div className="flex items-center gap-2.5 text-xs text-gray-400 mt-0.5 flex-wrap">
                          <span>{formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</span>
                          {issue.location && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{issue.location.name}</span>
                          )}
                        </div>
                      </div>
                      <Badge className={`${STATUS_COLOR[issue.status]} text-[10px] px-1.5 py-0 border shrink-0`}>
                        {ISSUE_STATUS[issue.status as keyof typeof ISSUE_STATUS] ?? issue.status}
                      </Badge>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </>
        ) : isPropertyMgmt ? (
          <>
            {/* PM KPI Cards */}
            <div data-tour="pm-kpi-cards" className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                {
                  label: "Open Property Issues", href: "/issues?status=OPEN",
                  iconEl: <AlertCircle className="w-[18px] h-[18px] text-blue-600" />,
                  iconBg: "bg-blue-100", accentBorder: "border-l-blue-500", bgTint: "rgba(59,130,246,0.05)",
                  value: <>{data.openIssues}</>,
                  secondary: `${data.newThisWeek} new this week`, secondaryColor: data.newThisWeek > 0 ? "text-amber-600" : "text-gray-400",
                },
                {
                  label: "Tenant Requests Today", href: "/issues?category=TENANT_REQUEST",
                  iconEl: <MessageSquare className="w-[18px] h-[18px] text-purple-600" />,
                  iconBg: "bg-purple-100", accentBorder: "border-l-purple-500", bgTint: "rgba(168,85,247,0.05)",
                  value: <>{data.tenantRequestsToday}</>,
                  secondary: "Submitted today via QR", secondaryColor: "text-gray-400",
                },
                {
                  label: "Open Maintenance", href: "/issues?category=MAINTENANCE",
                  iconEl: <Wrench className={`w-[18px] h-[18px] ${data.openMaintenanceIssues > 0 ? "text-amber-600" : "text-gray-400"}`} />,
                  iconBg: data.openMaintenanceIssues > 0 ? "bg-amber-100" : "bg-gray-100",
                  accentBorder: data.openMaintenanceIssues > 0 ? "border-l-amber-500" : "border-l-gray-300",
                  bgTint: data.openMaintenanceIssues > 0 ? "rgba(245,158,11,0.05)" : "rgba(100,116,139,0.03)",
                  value: <>{data.openMaintenanceIssues}</>,
                  secondary: "Active work items", secondaryColor: "text-gray-400",
                },
                {
                  label: "Equipment Down", href: "/assets",
                  iconEl: <Package className={`w-[18px] h-[18px] ${data.totalAssets - data.operationalAssets > 0 ? "text-orange-600" : "text-gray-400"}`} />,
                  iconBg: data.totalAssets - data.operationalAssets > 0 ? "bg-orange-100" : "bg-gray-100",
                  accentBorder: data.totalAssets - data.operationalAssets > 0 ? "border-l-orange-500" : "border-l-gray-300",
                  bgTint: data.totalAssets - data.operationalAssets > 0 ? "rgba(249,115,22,0.05)" : "rgba(100,116,139,0.03)",
                  value: <span className={data.totalAssets - data.operationalAssets > 0 ? "text-orange-600" : ""}>{data.totalAssets - data.operationalAssets}</span>,
                  secondary: `${data.operationalAssets} of ${data.totalAssets} operational`, secondaryColor: "text-gray-400",
                },
                {
                  label: "High-Priority Issues", href: "/issues?priority=HIGH",
                  iconEl: <AlertTriangle className={`w-[18px] h-[18px] ${data.highPriorityIssues > 0 ? "text-red-600" : "text-gray-400"}`} />,
                  iconBg: data.highPriorityIssues > 0 ? "bg-red-100" : "bg-gray-100",
                  accentBorder: data.highPriorityIssues > 0 ? "border-l-red-500" : "border-l-gray-300",
                  bgTint: data.highPriorityIssues > 0 ? "rgba(239,68,68,0.05)" : "rgba(100,116,139,0.03)",
                  value: <span className={data.highPriorityIssues > 0 ? "text-red-600" : ""}>{data.highPriorityIssues}</span>,
                  secondary: "Critical + high open", secondaryColor: data.highPriorityIssues > 0 ? "text-red-500 font-medium" : "text-gray-400",
                },
                {
                  label: "Unassigned Issues", href: "/issues?status=OPEN",
                  iconEl: <UserX className={`w-[18px] h-[18px] ${data.unassignedIssues > 0 ? "text-slate-600" : "text-gray-400"}`} />,
                  iconBg: data.unassignedIssues > 0 ? "bg-slate-100" : "bg-gray-100",
                  accentBorder: data.unassignedIssues > 0 ? "border-l-slate-500" : "border-l-gray-300",
                  bgTint: "rgba(100,116,139,0.04)",
                  value: <>{data.unassignedIssues}</>,
                  secondary: "Need assignment", secondaryColor: data.unassignedIssues > 0 ? "text-amber-600" : "text-gray-400",
                },
              ].map(({ label, href, iconEl, iconBg, accentBorder, bgTint, value, secondary, secondaryColor }) => (
                <Link
                  key={label}
                  href={href}
                  className={`rounded-xl border border-gray-200 border-l-4 ${accentBorder} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150`}
                  style={{ background: `linear-gradient(135deg, ${bgTint} 0%, white 60%)` }}
                >
                  <div className={`w-9 h-9 ${iconBg} rounded-full flex items-center justify-center mb-3`}>
                    {iconEl}
                  </div>
                  <div className="text-3xl font-black text-gray-900 leading-none">{value}</div>
                  <div className="text-[13px] font-medium text-gray-600 mt-1">{label}</div>
                  <div className={`text-[11px] mt-1.5 ${secondaryColor}`}>{secondary}</div>
                </Link>
              ))}
            </div>

            {/* PM Equipment Status Grid */}
            <div data-tour="pm-equipment-status" className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Equipment Status</h2>
                <Link href="/assets" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
                  All equipment <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {data.equipmentAssets.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No equipment tracked yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                  {data.equipmentAssets.map((asset) => {
                    const statusConfig = {
                      OPERATIONAL:    { label: "Operational",    bg: "bg-emerald-100", text: "text-emerald-700" },
                      MAINTENANCE:    { label: "Maintenance",    bg: "bg-amber-100",   text: "text-amber-700"   },
                      INACTIVE:       { label: "Inactive",       bg: "bg-gray-100",    text: "text-gray-600"    },
                      OUT_OF_SERVICE: { label: "Out of Service", bg: "bg-red-100",     text: "text-red-700"     },
                    }[asset.status] ?? { label: asset.status, bg: "bg-gray-100", text: "text-gray-600" }
                    const subtypeLabel = asset.assetSubtype
                      ? (PM_ASSET_TAXONOMY[asset.assetSubtype as keyof typeof PM_ASSET_TAXONOMY] ?? asset.assetSubtype)
                      : null
                    const openIssueCount = asset.issues.length
                    return (
                      <Link
                        key={asset.id}
                        href={`/assets/${asset.id}`}
                        className="px-4 py-3.5 hover:bg-gray-50/70 transition-colors flex flex-col gap-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900 leading-tight truncate">{asset.name}</span>
                          {openIssueCount > 0 && (
                            <span className="shrink-0 bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {openIssueCount} issue{openIssueCount > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {subtypeLabel && <span className="text-[11px] text-gray-400">{subtypeLabel}</span>}
                        <span className={`self-start text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                          {statusConfig.label}
                        </span>
                        {asset.location && (
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Home className="w-3 h-3" />{asset.location.name}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Recent Tenant Requests */}
            <div data-tour="pm-tenant-requests" className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Recent Tenant Requests</h2>
                <Link href="/issues?category=TENANT_REQUEST" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {data.recentTenantRequests.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <QrCode className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No tenant requests yet — set up a QR code in common areas to start collecting requests</p>
                  </div>
                ) : (
                  data.recentTenantRequests.map((issue) => (
                    <Link
                      key={issue.id}
                      href={`/issues/${issue.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center border border-purple-100 shrink-0">
                        <MessageSquare className="w-4 h-4 text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{issue.title}</div>
                        <div className="flex items-center gap-2.5 text-xs text-gray-400 mt-0.5 flex-wrap">
                          <span>{formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</span>
                          {issue.location && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{issue.location.name}</span>
                          )}
                          {issue.assignedTo && (
                            <span className="text-blue-500">→ {issue.assignedTo.name}</span>
                          )}
                        </div>
                      </div>
                      <Badge className={`${STATUS_COLOR[issue.status]} text-[10px] px-1.5 py-0 border shrink-0`}>
                        {ISSUE_STATUS[issue.status as keyof typeof ISSUE_STATUS] ?? issue.status}
                      </Badge>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ── Generic KPI Cards ───────────────────────────────────── */}
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
                  <div className="text-[13px] font-medium text-gray-600 mt-1">{label}</div>
                  <div className={`text-[11px] mt-1.5 ${secondaryColor}`}>{secondary}</div>
                </Link>
              ))}
            </div>

            {/* ── Recent Issues (60%) + Category Chart (40%) ───────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Recent Issues */}
              <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900">Recent Issues</h2>
                  <Link href="/issues" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.recentIssues.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <AlertCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No issues yet</p>
                    </div>
                  ) : (
                    data.recentIssues.map((issue) => {
                      const waiting = getWaiting(issue.createdAt, issue.status)
                      const assigneeInitial = issue.assignedTo?.name?.charAt(0).toUpperCase()
                      const firstImg = issue.attachments[0]?.url ?? null
                      const catBg  = CATEGORY_ICON_BG[issue.category]  ?? "bg-gray-100"
                      const catClr = CATEGORY_ICON_CLR[issue.category] ?? "text-gray-400"

                      return (
                        <Link
                          key={issue.id}
                          href={`/issues/${issue.id}`}
                          className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-all duration-150"
                        >
                          <div className="shrink-0">
                            {firstImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={firstImg} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-100" />
                            ) : (
                              <div className={`w-8 h-8 rounded-lg ${catBg} flex items-center justify-center border border-gray-100`}>
                                <AlertCircle className={`w-4 h-4 ${catClr}`} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{issue.title}</span>
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

              {/* Category Chart */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900">By Category</h2>
                  <span className="text-xs text-gray-400 font-medium">{data.totalIssues} total</span>
                </div>
                <div className="px-5 py-4 space-y-4">
                  {data.issuesByCategory.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No data yet</p>
                  ) : (
                    data.issuesByCategory.slice(0, 8).map((item) => {
                      const total = data.totalIssues || 1
                      const pct = Math.round((item._count.id / total) * 100)
                      const barHex = CATEGORY_COLOR_HEX[item.category] ?? "#94a3b8"
                      const label = ISSUE_CATEGORY[item.category as keyof typeof ISSUE_CATEGORY] ?? item.category

                      return (
                        <div key={item.category}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[13px] font-semibold text-gray-900 truncate max-w-[130px]">{label}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs font-bold" style={{ color: barHex }}>{pct}%</span>
                              <span className="text-[13px] font-black text-gray-900 w-5 text-right">{item._count.id}</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
                            <div
                              className="h-3.5 rounded-full transition-all duration-300"
                              style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: barHex }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

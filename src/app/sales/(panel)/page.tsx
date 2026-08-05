import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import {
  AlertCircle, Clock, Mail, FileText, Calendar, Users, TrendingUp,
  ArrowRight, CheckCircle2, Target, Zap, MessageSquare, BarChart2,
  GitBranch, Bell, Sparkles,
} from "lucide-react"

export const dynamic = "force-dynamic"

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "today" | "week" | "month" | "30d" | "all"

interface StageRow   { stageNumber: number | null; sent_count: bigint; reply_count: bigint }
interface AvgDayRow  { avg_days: number | null }
interface AvgStage   { avg_stage: number | null }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function periodStart(p: Period): Date | null {
  const now = new Date()
  if (p === "today")  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (p === "week")   { const d = new Date(now); d.setDate(now.getDate() - 7);   d.setHours(0,0,0,0); return d }
  if (p === "month")  return new Date(now.getFullYear(), now.getMonth(), 1)
  if (p === "30d")    return new Date(now.getTime() - 30 * 864e5)
  return null
}

function pct(num: number, denom: number, digits = 1): string {
  if (!denom) return "—"
  return (num / denom * 100).toFixed(digits) + "%"
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—"
  return n.toLocaleString()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = "text-white" }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">{title}</h2>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function NA({ label }: { label: string }) {
  return (
    <span className="text-gray-600" title={label}>—</span>
  )
}

// ─── AI Insights (server + Suspense) ──────────────────────────────────────────

async function AIInsightsServer({ metrics }: { metrics: Record<string, number | string> }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return (
      <div className="text-sm text-gray-600 italic">
        AI insights unavailable — set ANTHROPIC_API_KEY to enable.
      </div>
    )
  }

  const metricsText = Object.entries(metrics)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ")

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{
          role:    "user",
          content: `You are a sales operations analyst. Given the following sales metrics, provide 4 concise, actionable insights (1-2 sentences each). Focus on what stands out, what needs attention, and what's working well. Be specific and direct — no fluff.\n\nMetrics: ${metricsText}\n\nReturn exactly 4 insights as a JSON array of strings. Nothing else.`,
        }],
      }),
    })

    if (!res.ok) throw new Error(`Anthropic ${res.status}`)
    const data = await res.json() as { content: { type: string; text: string }[] }
    const text  = data.content.find(c => c.type === "text")?.text ?? "[]"
    const insights = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? "[]") as string[]

    if (!insights.length) throw new Error("empty")

    return (
      <ul className="space-y-3">
        {insights.map((insight, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
            <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-900/60 text-emerald-400 text-xs font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            {insight}
          </li>
        ))}
      </ul>
    )
  } catch {
    return <p className="text-sm text-gray-600">Could not generate insights at this time.</p>
  }
}

function InsightsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-4 bg-gray-800 rounded animate-pulse" style={{ width: `${60 + i * 8}%` }} />
      ))}
    </div>
  )
}

// ─── Period selector ──────────────────────────────────────────────────────────

function PeriodSelector({ current }: { current: Period }) {
  const options: { value: Period; label: string }[] = [
    { value: "today",  label: "Today" },
    { value: "week",   label: "This Week" },
    { value: "month",  label: "This Month" },
    { value: "30d",    label: "Last 30 Days" },
    { value: "all",    label: "All Time" },
  ]
  return (
    <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
      {options.map(o => (
        <Link
          key={o.value}
          href={`/sales?period=${o.value}`}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            current === o.value
              ? "bg-emerald-600 text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  )
}

// ─── Stage bar chart ──────────────────────────────────────────────────────────

function StageChart({ rows }: { rows: StageRow[] }) {
  if (!rows.length) return <p className="text-sm text-gray-600">No stage data yet.</p>

  const max = Math.max(...rows.map(r => Number(r.reply_count)), 1)
  const labels = ["Stage 0", "Stage 1", "Stage 2", "Stage 3", "Stage 4+"]

  const buckets: { label: string; count: number; sent: number }[] = labels.map((label, i) => {
    const isLast = i === labels.length - 1
    const matching = isLast
      ? rows.filter(r => (r.stageNumber ?? 0) >= 4)
      : rows.filter(r => r.stageNumber === i)
    const count = matching.reduce((s, r) => s + Number(r.reply_count), 0)
    const sent  = matching.reduce((s, r) => s + Number(r.sent_count),  0)
    return { label, count, sent }
  })

  return (
    <div className="flex items-end gap-2 h-24 mt-2">
      {buckets.map(b => {
        const h = max > 0 ? Math.max((b.count / max) * 100, b.count > 0 ? 4 : 0) : 0
        const rate = b.sent > 0 ? ((b.count / b.sent) * 100).toFixed(0) + "%" : "—"
        return (
          <div key={b.label} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full bg-emerald-600/70 rounded-t-sm transition-all hover:bg-emerald-500"
              style={{ height: `${h}%`, minHeight: b.count > 0 ? "4px" : "0" }}
            />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap z-10 shadow-lg">
              {b.count} replies · {rate} rate
            </div>
            <span className="text-[9px] text-gray-600 truncate w-full text-center">{b.label.split(" ")[1]}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

function Funnel({ rows }: { rows: { label: string; count: number }[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap mt-4">
      {rows.map((r, i) => {
        const prev = rows[i - 1]
        const rate = prev && prev.count > 0
          ? ` (${((r.count / prev.count) * 100).toFixed(0)}%)`
          : ""
        return (
          <div key={r.label} className="flex items-center gap-1">
            {i > 0 && <ArrowRight className="w-3 h-3 text-gray-700 shrink-0" />}
            <div className="text-center">
              <div className="text-base font-bold text-white">{r.count.toLocaleString()}</div>
              <div className="text-[10px] text-gray-500">{r.label}</div>
              {rate && <div className="text-[10px] text-emerald-500">{rate}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SalesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/sales/login")

  const params = await searchParams
  const period = (params.period ?? "week") as Period
  const pStart = periodStart(period)

  const now          = new Date()
  const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd     = new Date(todayStart.getTime() + 864e5)
  const weekStart    = new Date(now.getTime() - 7 * 864e5);  weekStart.setHours(0,0,0,0)
  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1)
  const last30Start  = new Date(now.getTime() - 30 * 864e5)

  const sentBase   = { direction: "sent"     as const, isDeleted: false }
  const recvBase   = { direction: "received" as const, isDeleted: false }
  const pGte       = pStart ? { gte: pStart } : undefined

  // ── All DB queries in parallel ──────────────────────────────────────────────
  const [
    // Action center (always "now")
    acFollowUpToday,
    acFollowUpOverdue,
    acRepliesUnread,
    acDraftsReady,
    acScheduledToday,
    acDemosThisWeek,

    // Activity
    sentToday,
    sentThisWeek,
    sentThisMonth,
    sent30d,
    prospectsThisWeek,
    totalProspects,

    // Quality
    totalContacts,
    invalidContacts,
    duplicateProspects,

    // Engagement (period)
    sentPeriod,
    recvPeriod,

    // Pipeline
    newLeadsThisWeek,
    activeEnrollments,
    demosScheduled,
    trialsActive,
    closedWon,
    closedLost,

    // Follow-up
    seqCompletedMonth,

    // Raw queries
    stageRows,
    avgDaysRow,
    avgStageRow,

    // Funnel counts
    funnelEmails,
    funnelReplied,
    funnelDemoSched,
    funnelTrial,
    funnelConverted,
  ] = await Promise.all([
    // Action center
    prisma.crmEmail.count({ where: { ...sentBase, followUpDate: { gte: todayStart, lt: todayEnd }, followUpDoneAt: null } }),
    prisma.crmEmail.count({ where: { ...sentBase, followUpDate: { lt: todayStart }, followUpDoneAt: null } }),
    prisma.crmEmail.count({ where: { ...recvBase, isRead: false, isArchived: false } }),
    prisma.crmFollowUp.count({ where: { status: "pending", draftBodyHtml: { not: null }, approvedAt: null } }).catch(() => 0),
    prisma.crmFollowUp.count({ where: { status: "pending", scheduledFor: { gte: todayStart, lt: todayEnd } } }).catch(() => 0),
    prisma.demoCall.count({ where: { scheduledAt: { gte: weekStart, lt: new Date(weekStart.getTime() + 7 * 864e5) } } }),

    // Activity
    prisma.crmEmail.count({ where: { ...sentBase, sentAt: { gte: todayStart } } }),
    prisma.crmEmail.count({ where: { ...sentBase, sentAt: { gte: weekStart } } }),
    prisma.crmEmail.count({ where: { ...sentBase, sentAt: { gte: monthStart } } }),
    prisma.crmEmail.count({ where: { ...sentBase, sentAt: { gte: last30Start } } }),
    prisma.prospect.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.prospect.count(),

    // Quality
    prisma.prospectContact.count(),
    prisma.prospectContact.count({ where: { emailConfidence: "invalid" } }),
    prisma.prospect.count({ where: { duplicateFlag: true } }),

    // Engagement
    prisma.crmEmail.count({ where: { ...sentBase, ...(pGte ? { sentAt: pGte } : {}) } }),
    prisma.crmEmail.count({ where: { ...recvBase, ...(pGte ? { sentAt: pGte } : {}) } }),

    // Pipeline
    prisma.demoCall.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.crmEmailSequenceEnrollment.count({ where: { status: "active" } }).catch(() => 0),
    prisma.demoCall.count({ where: { callStatus: "Scheduled" } }),
    prisma.demoCall.count({ where: { callStatus: "Trial Active" } }),
    prisma.demoCall.count({ where: { callStatus: "Converted" } }),
    prisma.demoCall.count({ where: { callStatus: "Lost" } }),

    // Follow-up
    prisma.crmEmailSequenceEnrollment.count({ where: { status: "completed", stoppedAt: { gte: monthStart } } }).catch(() => 0),

    // Stage replies raw query
    prisma.$queryRaw<StageRow[]>`
      SELECT
        ce."stageNumber",
        COUNT(DISTINCT ce.id)::bigint    AS sent_count,
        COUNT(DISTINCT reply.id)::bigint AS reply_count
      FROM "CrmEmail" ce
      LEFT JOIN "CrmEmail" reply
        ON reply."threadId" = ce."threadId"
        AND reply.direction = 'received'
        AND reply."isDeleted" = false
      WHERE ce.direction = 'sent'
        AND ce."stageNumber" IS NOT NULL
        AND ce."isDeleted" = false
      GROUP BY ce."stageNumber"
      ORDER BY ce."stageNumber"
    `.catch(() => [] as StageRow[]),

    // Avg days to first reply
    prisma.$queryRaw<AvgDayRow[]>`
      WITH fs AS (
        SELECT "threadId", MIN("sentAt") AS t FROM "CrmEmail" WHERE direction='sent'  AND "isDeleted"=false GROUP BY "threadId"
      ),
      fr AS (
        SELECT "threadId", MIN("sentAt") AS t FROM "CrmEmail" WHERE direction='received' AND "isDeleted"=false GROUP BY "threadId"
      )
      SELECT AVG(EXTRACT(EPOCH FROM (fr.t - fs.t)) / 86400.0) AS avg_days
      FROM fs JOIN fr ON fr."threadId" = fs."threadId" WHERE fr.t > fs.t
    `.catch(() => [{ avg_days: null }] as AvgDayRow[]),

    // Avg stage of active outreach
    prisma.$queryRaw<AvgStage[]>`
      SELECT AVG("stageNumber"::float) AS avg_stage
      FROM "CrmEmail"
      WHERE direction='sent' AND "stageNumber" IS NOT NULL AND "isDeleted"=false
    `.catch(() => [{ avg_stage: null }] as AvgStage[]),

    // Funnel
    prisma.crmEmail.count({ where: { ...sentBase } }),
    prisma.crmEmail.count({ where: { ...recvBase } }),
    prisma.demoCall.count({ where: { callStatus: { in: ["Scheduled", "Demo Completed", "Trial Active", "Trial Expired", "Converted"] } } }),
    prisma.demoCall.count({ where: { callStatus: { in: ["Trial Active", "Trial Expired", "Converted"] } } }),
    prisma.demoCall.count({ where: { callStatus: "Converted" } }),
  ])

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const replyRate      = pct(recvPeriod, sentPeriod)
  const invalidRate    = pct(invalidContacts, totalContacts)
  const dupRate        = pct(duplicateProspects, totalProspects)
  const avgPerDay      = sent30d > 0 ? (sent30d / 30).toFixed(1) : "—"
  const winRate        = pct(closedWon, closedWon + closedLost)
  const avgDays        = avgDaysRow[0]?.avg_days != null ? Number(avgDaysRow[0].avg_days).toFixed(1) : null
  const avgStageNum    = avgStageRow[0]?.avg_stage != null ? Number(avgStageRow[0].avg_stage).toFixed(1) : null
  const bestStage      = stageRows.length > 0
    ? stageRows.reduce((best, r) => Number(r.reply_count) > Number(best.reply_count) ? r : best, stageRows[0])
    : null

  const aiMetrics = {
    "Emails sent (period)": sentPeriod,
    "Replies received (period)": recvPeriod,
    "Reply rate": replyRate,
    "Overdue follow-ups": acFollowUpOverdue,
    "Active in sequence": activeEnrollments,
    "Demos scheduled": demosScheduled,
    "Trials active": trialsActive,
    "Closed won": closedWon,
    "Closed lost": closedLost,
    "Win rate": winRate,
    "Total prospects": totalProspects,
    "Invalid email rate": invalidRate,
    "Avg days to first reply": avgDays ?? "N/A",
    "Best reply stage": bestStage ? `Stage ${bestStage.stageNumber}` : "N/A",
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your complete sales operations view</p>
        </div>
        <PeriodSelector current={period} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 1 — ACTION CENTER
      ══════════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-bold text-white">Action Center</h2>
            <span className="text-xs text-gray-500">What needs your attention right now</span>
          </div>
          <Link
            href="/sales/outreach/follow-ups"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Work Follow-Up Queue
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Follow-ups due today */}
          <Link href="/sales/outreach/follow-ups" className="group">
            <div className={`bg-gray-900 border rounded-xl p-4 h-full transition-colors group-hover:border-gray-600 ${acFollowUpToday > 0 ? "border-amber-800/60" : "border-gray-800"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className={`w-4 h-4 ${acFollowUpToday > 0 ? "text-amber-400" : "text-gray-500"}`} />
                <span className="text-xs text-gray-500">Due Today</span>
              </div>
              <p className={`text-3xl font-bold ${acFollowUpToday > 0 ? "text-amber-400" : "text-gray-500"}`}>
                {acFollowUpToday}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">follow-up reminders</p>
            </div>
          </Link>

          {/* Overdue */}
          <Link href="/sales/outreach/follow-ups" className="group">
            <div className={`bg-gray-900 border rounded-xl p-4 h-full transition-colors group-hover:border-gray-600 ${acFollowUpOverdue > 0 ? "border-red-800/60" : "border-gray-800"}`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className={`w-4 h-4 ${acFollowUpOverdue > 0 ? "text-red-400" : "text-gray-500"}`} />
                <span className="text-xs text-gray-500">Overdue</span>
              </div>
              <p className={`text-3xl font-bold ${acFollowUpOverdue > 0 ? "text-red-400" : "text-gray-500"}`}>
                {acFollowUpOverdue}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">follow-ups past due</p>
            </div>
          </Link>

          {/* Replies awaiting */}
          <Link href="/sales/outreach/email" className="group">
            <div className={`bg-gray-900 border rounded-xl p-4 h-full transition-colors group-hover:border-gray-600 ${acRepliesUnread > 0 ? "border-emerald-800/60" : "border-gray-800"}`}>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className={`w-4 h-4 ${acRepliesUnread > 0 ? "text-emerald-400" : "text-gray-500"}`} />
                <span className="text-xs text-gray-500">Replies</span>
              </div>
              <p className={`text-3xl font-bold ${acRepliesUnread > 0 ? "text-emerald-400" : "text-gray-500"}`}>
                {acRepliesUnread}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">unread responses</p>
            </div>
          </Link>

          {/* Drafts ready */}
          <Link href="/sales/outreach/sequences" className="group">
            <div className={`bg-gray-900 border rounded-xl p-4 h-full transition-colors group-hover:border-gray-600 ${acDraftsReady > 0 ? "border-yellow-800/60" : "border-gray-800"}`}>
              <div className="flex items-center gap-2 mb-2">
                <FileText className={`w-4 h-4 ${acDraftsReady > 0 ? "text-yellow-400" : "text-gray-500"}`} />
                <span className="text-xs text-gray-500">Drafts</span>
              </div>
              <p className={`text-3xl font-bold ${acDraftsReady > 0 ? "text-yellow-400" : "text-gray-500"}`}>
                {acDraftsReady}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">ready for review</p>
            </div>
          </Link>

          {/* Scheduled today */}
          <Link href="/sales/outreach/sequences" className="group">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-full transition-colors group-hover:border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500">Scheduled</span>
              </div>
              <p className="text-3xl font-bold text-white">{acScheduledToday}</p>
              <p className="text-[10px] text-gray-600 mt-1">emails today</p>
            </div>
          </Link>

          {/* Demos this week */}
          <Link href="/sales/pipeline" className="group">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-full transition-colors group-hover:border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-500">Demos</span>
              </div>
              <p className="text-3xl font-bold text-white">{acDemosThisWeek}</p>
              <p className="text-[10px] text-gray-600 mt-1">scheduled this week</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 2 — OUTREACH KPIs
      ══════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Activity */}
        <div>
          <SectionHeader title="Outreach Activity" sub="Email sending volume" />
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Sent Today"            value={sentToday}  />
            <KpiCard label="Sent This Week"        value={sentThisWeek} />
            <KpiCard label="Sent This Month"       value={sentThisMonth} />
            <KpiCard label="Avg / Day (30d)"       value={avgPerDay} sub="emails per day" />
            <KpiCard label="New Prospects (7d)"    value={prospectsThisWeek} />
            <KpiCard label="Total Prospects"       value={totalProspects} sub="in database" />
          </div>
        </div>

        {/* Quality */}
        <div>
          <SectionHeader title="Data Quality" sub="Prospect database health" />
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label="Invalid Email Rate"
              value={totalContacts > 0 ? invalidRate : "—"}
              sub={`${invalidContacts} of ${totalContacts} contacts`}
              color={invalidContacts > 0 ? "text-red-400" : "text-white"}
            />
            <KpiCard
              label="Duplicate Rate"
              value={totalProspects > 0 ? dupRate : "—"}
              sub={`${duplicateProspects} flagged`}
              color={duplicateProspects > 0 ? "text-amber-400" : "text-white"}
            />
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 col-span-2">
              <p className="text-xs text-gray-500 mb-1">Bounce Rate</p>
              <p className="text-lg font-bold text-gray-600">N/A</p>
              <p className="text-[11px] text-gray-700 mt-0.5">Bounce tracking requires a sending API that reports bounces. Not currently enabled.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 3 — ENGAGEMENT KPIs
      ══════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader
          title="Engagement"
          sub={`Based on emails in the selected period${pStart ? "" : " (all time)"}`}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard
            label="Reply Rate"
            value={sentPeriod > 0 ? replyRate : "—"}
            sub={`${recvPeriod} replies / ${sentPeriod} sent`}
            color={sentPeriod > 0 && recvPeriod / sentPeriod > 0.05 ? "text-emerald-400" : "text-white"}
          />
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Positive Reply Rate</p>
            <p className="text-2xl font-bold text-gray-600">N/A</p>
            <p className="text-[11px] text-gray-700 mt-0.5">Requires manual reply classification</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Tour Click Rate</p>
            <p className="text-2xl font-bold text-gray-600">N/A</p>
            <p className="text-[11px] text-gray-700 mt-0.5">Requires tour link click tracking</p>
          </div>
          <KpiCard
            label="Demo Rate"
            value={sentPeriod > 0 ? pct(demosScheduled + trialsActive + closedWon, sentPeriod, 2) : "—"}
            sub="demos / emails sent (approx)"
          />
        </div>

        {/* Funnel */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 mb-1">Conversion Funnel</p>
          <p className="text-[11px] text-gray-600 mb-3">All-time totals · arrows show stage-to-stage conversion rate</p>
          <Funnel rows={[
            { label: "Emails Sent",       count: funnelEmails },
            { label: "Replied",           count: funnelReplied },
            { label: "Demo Scheduled",    count: funnelDemoSched },
            { label: "Trial Started",     count: funnelTrial },
            { label: "Customer",          count: funnelConverted },
          ]} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 4 — PIPELINE KPIs
      ══════════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader title="Pipeline" sub="Lead and deal tracking" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="New Leads (7d)"      value={newLeadsThisWeek} />
          <KpiCard label="Active in Sequence"  value={activeEnrollments} />
          <KpiCard label="Demos Scheduled"     value={demosScheduled}    color="text-blue-400" />
          <KpiCard label="Trials Active"       value={trialsActive}      color="text-purple-400" />
          <KpiCard label="Closed Won"          value={closedWon}         color="text-emerald-400" />
          <KpiCard label="Closed Lost"         value={closedLost}        color={closedLost > 0 ? "text-red-400" : "text-white"} />
          <KpiCard
            label="Win Rate"
            value={closedWon + closedLost > 0 ? winRate : "—"}
            sub={`${closedWon}W / ${closedLost}L`}
            color={closedWon + closedLost > 0 && closedWon / (closedWon + closedLost) > 0.3 ? "text-emerald-400" : "text-white"}
          />
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Avg Days to Trial</p>
            <p className="text-2xl font-bold text-gray-600">N/A</p>
            <p className="text-[11px] text-gray-700 mt-0.5">Requires tracking first contact date per deal</p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 5 — FOLLOW-UP KPIs
      ══════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader title="Follow-Up Sequence" sub="Stage and sequence performance" />
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Active in Sequence"       value={activeEnrollments} />
            <KpiCard
              label="Avg Stage"
              value={avgStageNum ?? "—"}
              sub="average outreach stage"
            />
            <KpiCard
              label="Completed (this month)"
              value={seqCompletedMonth}
              color="text-emerald-400"
            />
            <KpiCard
              label="Best Reply Stage"
              value={bestStage != null ? `Stage ${bestStage.stageNumber}` : "—"}
              sub={bestStage ? `${fmt(Number(bestStage.reply_count))} replies` : undefined}
              color="text-emerald-400"
            />
            <KpiCard
              label="Avg Days to First Reply"
              value={avgDays != null ? `${avgDays}d` : "—"}
              sub="across all threads"
            />
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Unsubscribe Rate</p>
              <p className="text-2xl font-bold text-gray-600">N/A</p>
              <p className="text-[11px] text-gray-700 mt-0.5">Requires unsubscribe link tracking</p>
            </div>
          </div>
        </div>

        {/* Stage chart */}
        <div>
          <SectionHeader title="Replies by Stage" sub="Which follow-up step generates the most responses" />
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-[11px] text-gray-600 mb-3">Hover bars for reply count and rate</p>
            <StageChart rows={stageRows} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 6 — AI INSIGHTS
      ══════════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">AI Insights</h2>
          <span className="text-[10px] text-gray-600 px-2 py-0.5 bg-gray-800 rounded-full">Generated from your data</span>
        </div>
        <div className="bg-gray-900 border border-purple-900/40 rounded-xl p-5">
          <Suspense fallback={<InsightsSkeleton />}>
            <AIInsightsServer metrics={aiMetrics} />
          </Suspense>
        </div>
      </div>

    </div>
  )
}

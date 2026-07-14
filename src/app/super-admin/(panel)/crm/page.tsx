import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { LIFECYCLE_STAGES, LIFECYCLE_COLORS, LIFECYCLE_CARD_COLORS } from "@/lib/crm-lifecycle-constants"
import {
  TrendingUp, Users, DollarSign, AlertTriangle, PhoneCall, Clock,
  CheckCircle2, XCircle, BarChart3, Zap, Mail, ArrowDownLeft, Calendar, MailWarning,
  ClipboardList,
} from "lucide-react"
import { CrmBackfillButton } from "@/components/super-admin/crm-backfill-button"
import { CrmSchedulingButton, CrmSchedulingButtonFallback } from "@/components/super-admin/crm-scheduling-button"

export const dynamic = "force-dynamic"

export default async function CrmDashboardPage() {
  const schedulingUrl   = process.env.CALENDLY_SCHEDULING_URL ?? null
  const now             = new Date()
  const sevenDaysOut    = new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const todayStart      = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd        = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const [
    pipelineCounts,
    demosToday,
    overdueFollowUps,
    trialsExpiringSoon,
    unconvertedExpired,
    staleLeads,
    recentActivities,
    activePaid,
    mrrData,
    emailSentToday,
    emailReceivedToday,
    emailFollowUpsDue,
    emailFollowupsDueList,
    noEmailContacts,
    followUpSummary,
  ] = await Promise.all([
    prisma.organization.groupBy({
      by:      ["lifecycleStatus"],
      _count:  { id: true },
      where:   { isDemo: false },
    }),
    prisma.demoCall.findMany({
      where:   { callStatus: "Scheduled", scheduledAt: { gte: todayStart, lt: todayEnd } },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.demoCall.findMany({
      where:   { followUpCompleted: false, followUpDate: { lt: now } },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { followUpDate: "asc" },
      take:    20,
    }),
    prisma.organization.findMany({
      where:   { lifecycleStatus: "Trial Active", trialEndsAt: { gt: now, lt: sevenDaysOut }, isDemo: false },
      select:  { id: true, name: true, trialEndsAt: true },
      orderBy: { trialEndsAt: "asc" },
    }),
    prisma.organization.findMany({
      where:   { lifecycleStatus: "Trial Expired", nonConversionReasons: { none: {} }, isDemo: false },
      select:  { id: true, name: true },
      take:    20,
    }),
    prisma.organization.findMany({
      where:   { lifecycleStatus: "Lead", updatedAt: { lt: fourteenDaysAgo }, isDemo: false },
      select:  { id: true, name: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
      take:    20,
    }),
    prisma.crmActivity.findMany({
      orderBy: { createdAt: "desc" },
      take:    20,
      include: { organization: { select: { id: true, name: true } } },
    }),
    prisma.organization.count({ where: { subscriptionStatus: "active", isDemo: false } }),
    prisma.organization.aggregate({
      where: { subscriptionStatus: "active", isDemo: false },
      _sum:  { monthlyTotalAfterDiscount: true },
    }),
    // Email stats
    prisma.crmEmail.count({ where: { direction: "sent",     sentAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.crmEmail.count({ where: { direction: "received", sentAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.crmEmail.count({ where: { followUpDate: { lte: now }, followUpDoneAt: null } }),
    prisma.crmEmail.findMany({
      where:   { followUpDate: { lte: now }, followUpDoneAt: null },
      include: { demoCall: { select: { id: true, contactName: true, companyName: true } } },
      orderBy: { followUpDate: "asc" },
      take:    10,
    }),
    // Contacts with no email in 14+ days
    prisma.demoCall.findMany({
      where: {
        callStatus: { notIn: ["Cancelled"] },
        updatedAt:  { lt: fourteenDaysAgo },
        crmEmails:  { none: {} },
      },
      select:  { id: true, contactName: true, companyName: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
      take:    10,
    }),
    // Follow-up queue summary
    Promise.all([
      prisma.crmFollowUp.count({ where: { status: "draft_generated", enrollment: { status: "active" } } }),
      prisma.crmFollowUp.count({ where: { status: "pending", scheduledFor: { lt: todayStart }, enrollment: { status: "active" } } }),
      prisma.crmFollowUp.count({ where: { status: "pending", scheduledFor: { gte: todayStart, lt: todayEnd }, enrollment: { status: "active" } } }),
      prisma.crmEmailSequenceEnrollment.count({ where: { status: "active" } }),
    ]).then(([drafted, overdueFU, dueTodayFU, active]) => ({ drafted, overdueFU, dueTodayFU, active })),
  ])

  // Build a full pipeline map including 0-count stages
  const countMap = new Map(pipelineCounts.map(r => [r.lifecycleStatus, r._count.id]))
  const pipeline = LIFECYCLE_STAGES.map(stage => ({ stage, count: countMap.get(stage) ?? 0 }))

  // Derive metrics from stage counts
  const converted     = countMap.get("Converted")    ?? 0
  const trialExpired  = countMap.get("Trial Expired") ?? 0
  const trialActive   = countMap.get("Trial Active")  ?? 0
  const trialStarted  = countMap.get("Trial Started") ?? 0
  const demoCompleted = countMap.get("Demo Completed") ?? 0
  const cancelled     = (countMap.get("Cancelled") ?? 0) + (countMap.get("Lost") ?? 0)
  const totalTrials   = trialStarted + trialActive + trialExpired + converted + cancelled

  const trialToPaidRate = (converted + trialExpired) > 0
    ? Math.round((converted / (converted + trialExpired)) * 100)
    : 0

  const demoToTrialBase = demoCompleted + totalTrials
  const demoToTrialRate = demoToTrialBase > 0
    ? Math.round((totalTrials / demoToTrialBase) * 100)
    : 0

  const churnBase = converted + cancelled
  const churnRate = churnBase > 0 ? Math.round((cancelled / churnBase) * 100) : 0

  const mrr    = Math.round(mrrData._sum.monthlyTotalAfterDiscount ?? 0)
  const avgRev = activePaid > 0 ? Math.round(mrr / activePaid) : 0

  const alertCount = demosToday.length + overdueFollowUps.length + trialsExpiringSoon.length +
    unconvertedExpired.length + staleLeads.length

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">CRM Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Customer lifecycle and pipeline tracking</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {alertCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              {alertCount} alert{alertCount !== 1 ? "s" : ""} require attention
            </span>
          )}
          {schedulingUrl
            ? <CrmSchedulingButton url={schedulingUrl} />
            : <CrmSchedulingButtonFallback />
          }
          <Link href="/super-admin/crm/demo-calls"
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-sm font-medium transition-colors">
            <PhoneCall className="w-4 h-4" />
            Demo Calls
          </Link>
        </div>
      </div>

      {/* One-time data fix — shows if most orgs are still "Lead" */}
      {(countMap.get("Lead") ?? 0) > 5 && (countMap.get("Converted") ?? 0) === 0 && (
        <CrmBackfillButton />
      )}

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Customers"
          value={activePaid}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="green"
          sub="Paid subscriptions"
        />
        <KpiCard
          label="Monthly Revenue"
          value={`$${mrr.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
          sub={`$${avgRev}/customer avg`}
        />
        <KpiCard
          label="Trial → Paid Rate"
          value={`${trialToPaidRate}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          color={trialToPaidRate >= 30 ? "green" : trialToPaidRate >= 15 ? "amber" : "red"}
          sub={`${converted} converted of ${converted + trialExpired} completed trials`}
        />
        <KpiCard
          label="Total Trials"
          value={totalTrials}
          icon={<Zap className="w-5 h-5" />}
          color="blue"
          sub={`${trialActive} active now`}
        />
        <KpiCard
          label="Demo → Trial Rate"
          value={`${demoToTrialRate}%`}
          icon={<BarChart3 className="w-5 h-5" />}
          color={demoToTrialRate >= 50 ? "green" : demoToTrialRate >= 25 ? "amber" : "red"}
          sub={`${demoCompleted} demos completed`}
        />
        <KpiCard
          label="Cancelled"
          value={cancelled}
          icon={<XCircle className="w-5 h-5" />}
          color={cancelled === 0 ? "green" : "red"}
          sub="Cancelled + Lost"
        />
        <KpiCard
          label="Churn Rate"
          value={`${churnRate}%`}
          icon={<TrendingUp className="w-5 h-5 rotate-180" />}
          color={churnRate === 0 ? "green" : churnRate <= 10 ? "amber" : "red"}
          sub={`${cancelled} lost of ${churnBase} ever paid`}
        />
        <KpiCard
          label="Active Alerts"
          value={alertCount}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={alertCount === 0 ? "green" : "red"}
          sub="Requiring follow-up"
        />
      </div>

      {/* Email Activity Cards */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Email Activity</h2>
          <Link href="/super-admin/crm/settings"
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            CRM Settings →
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <EmailStatCard
            label="Sent Today"
            value={emailSentToday}
            icon={<Mail className="w-5 h-5" />}
            color="blue"
            href="/super-admin/crm/demo-calls"
          />
          <EmailStatCard
            label="Replies Today"
            value={emailReceivedToday}
            icon={<ArrowDownLeft className="w-5 h-5" />}
            color="green"
            href="/super-admin/crm/demo-calls"
          />
          <EmailStatCard
            label="Follow-ups Due"
            value={emailFollowUpsDue}
            icon={<Calendar className="w-5 h-5" />}
            color={emailFollowUpsDue > 0 ? "amber" : "green"}
            href="/super-admin/crm/demo-calls"
          />
          <EmailStatCard
            label="No Email (14d+)"
            value={noEmailContacts.length}
            icon={<MailWarning className="w-5 h-5" />}
            color={noEmailContacts.length > 0 ? "red" : "green"}
            href="/super-admin/crm/demo-calls"
          />
        </div>

        {/* Follow-ups due list */}
        {emailFollowupsDueList.length > 0 && (
          <div className="mt-4 bg-gray-900 border border-amber-800/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-white">Email Follow-ups Due</span>
            </div>
            <ul className="divide-y divide-gray-800">
              {emailFollowupsDueList.map(e => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200">
                      {e.demoCall ? `${e.demoCall.contactName} — ${e.demoCall.companyName}` : e.contactEmail}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{e.subject}</p>
                  </div>
                  <span className="text-xs text-amber-400 whitespace-nowrap">
                    Due {new Date(e.followUpDate!).toLocaleDateString()}
                  </span>
                  {e.demoCall && (
                    <Link href={`/super-admin/crm/demo-calls/${e.demoCall.id}`}
                      className="text-xs text-indigo-400 hover:underline whitespace-nowrap">
                      View →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* No-email contacts */}
        {noEmailContacts.length > 0 && (
          <div className="mt-4 bg-gray-900 border border-red-900/40 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <MailWarning className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-white">Contacts with No Email (14+ days)</span>
            </div>
            <ul className="divide-y divide-gray-800">
              {noEmailContacts.map(c => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200">{c.contactName}</p>
                    <p className="text-xs text-gray-500">{c.companyName}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    Last active {c.updatedAt.toLocaleDateString()}
                  </span>
                  <Link href={`/super-admin/crm/demo-calls/${c.id}`}
                    className="text-xs text-indigo-400 hover:underline whitespace-nowrap">
                    Email →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Follow-Up Queue Widget */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-400" />
            Follow-Up Queue
          </h2>
          <Link href="/super-admin/crm/follow-ups"
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            Open Queue →
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Drafted for Review",
              value: followUpSummary.drafted,
              color: followUpSummary.drafted > 0 ? "bg-indigo-900/30 border-indigo-700/40 text-indigo-300" : "bg-gray-900 border-gray-700 text-gray-400",
              badge: followUpSummary.drafted > 0 ? "Ready to send" : "None",
            },
            {
              label: "Overdue",
              value: followUpSummary.overdueFU,
              color: followUpSummary.overdueFU > 0 ? "bg-red-900/30 border-red-700/40 text-red-300" : "bg-gray-900 border-gray-700 text-gray-400",
              badge: followUpSummary.overdueFU > 0 ? "Past due" : "None",
            },
            {
              label: "Due Today",
              value: followUpSummary.dueTodayFU,
              color: followUpSummary.dueTodayFU > 0 ? "bg-yellow-900/30 border-yellow-700/40 text-yellow-300" : "bg-gray-900 border-gray-700 text-gray-400",
              badge: followUpSummary.dueTodayFU > 0 ? "Send today" : "None",
            },
            {
              label: "Active Sequences",
              value: followUpSummary.active,
              color: "bg-gray-900 border-gray-700 text-gray-300",
              badge: "In progress",
            },
          ].map(({ label, value, color, badge }) => (
            <Link key={label} href="/super-admin/crm/follow-ups"
              className={`border rounded-xl p-4 flex flex-col gap-2 hover:opacity-90 transition-opacity ${color}`}
            >
              <span className="text-xs font-medium opacity-80">{label}</span>
              <span className="text-3xl font-bold tabular-nums">{value}</span>
              <span className="text-xs opacity-70">{badge}</span>
            </Link>
          ))}
        </div>
        {(followUpSummary.drafted + followUpSummary.overdueFU + followUpSummary.dueTodayFU) > 0 && (
          <div className="mt-3">
            <Link
              href="/super-admin/crm/follow-ups"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <ClipboardList className="w-4 h-4" />
              Work Follow-Up Queue ({followUpSummary.drafted + followUpSummary.overdueFU + followUpSummary.dueTodayFU} items)
            </Link>
          </div>
        )}
      </section>

      {/* Pipeline Funnel */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Pipeline</h2>
          <span className="text-xs text-gray-500">Click a stage to view matching customers</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {pipeline.map(({ stage, count }) => {
            const c = LIFECYCLE_CARD_COLORS[stage] ?? { card: "bg-gray-800 border-gray-700", count: "text-white", label: "text-gray-400" }
            return (
              <Link
                key={stage}
                href={`/super-admin/organizations?lifecycle=${encodeURIComponent(stage)}`}
                className={`group relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all hover:scale-105 hover:shadow-lg hover:shadow-black/30 ${c.card}`}
              >
                <span className={`text-3xl font-bold leading-none ${c.count}`}>{count}</span>
                <span className={`text-[10px] font-medium text-center leading-tight mt-2 ${c.label}`}>{stage}</span>
                <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-medium mt-1 ${LIFECYCLE_COLORS[stage]}`}>
                  ●
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Alerts */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Follow-up Alerts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <AlertCard
            title="Demos Today"
            count={demosToday.length}
            icon={<PhoneCall className="w-4 h-4" />}
            urgency="blue"
            items={demosToday.map(d => ({
              label: d.contactName,
              sub: d.scheduledAt
                ? new Date(d.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : d.companyName,
              href: d.organizationId
                ? `/super-admin/organizations/${d.organizationId}`
                : `/super-admin/crm/demo-calls/${d.id}`,
            }))}
            emptyText="No demos scheduled today"
          />
          <AlertCard
            title="Follow-ups Due"
            count={overdueFollowUps.length}
            icon={<Clock className="w-4 h-4" />}
            urgency="red"
            items={overdueFollowUps.map(d => ({
              label: d.contactName,
              sub: `Due ${d.followUpDate?.toLocaleDateString()}`,
              href: d.organizationId
                ? `/super-admin/organizations/${d.organizationId}`
                : `/super-admin/crm/demo-calls/${d.id}`,
            }))}
            emptyText="No overdue follow-ups"
          />
          <AlertCard
            title="Trials Expiring (7d)"
            count={trialsExpiringSoon.length}
            icon={<AlertTriangle className="w-4 h-4" />}
            urgency="amber"
            items={trialsExpiringSoon.map(o => ({
              label: o.name,
              sub: `Expires ${o.trialEndsAt?.toLocaleDateString()}`,
              href: `/super-admin/organizations/${o.id}`,
            }))}
            emptyText="No trials expiring soon"
          />
          <AlertCard
            title="Expired, No Reason"
            count={unconvertedExpired.length}
            icon={<XCircle className="w-4 h-4" />}
            urgency="orange"
            items={unconvertedExpired.map(o => ({
              label: o.name,
              sub: "Missing non-conversion reason",
              href: `/super-admin/organizations/${o.id}`,
            }))}
            emptyText="All expired trials documented"
          />
          <AlertCard
            title="Stale Leads (14d+)"
            count={staleLeads.length}
            icon={<Users className="w-4 h-4" />}
            urgency="gray"
            items={staleLeads.map(o => ({
              label: o.name,
              sub: `Last activity ${o.updatedAt.toLocaleDateString()}`,
              href: `/super-admin/organizations/${o.id}`,
            }))}
            emptyText="No stale leads"
          />
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          <Link href="/super-admin/crm/demo-calls"
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            View all demo calls →
          </Link>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {recentActivities.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-gray-500 text-sm">No CRM activity recorded yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {recentActivities.map((a, i) => (
                <li key={a.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-800/40 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm mt-0.5">
                    {EVENT_EMOJI[a.eventType] ?? "•"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300">{a.description}</p>
                    {a.organization && (
                      <Link href={`/super-admin/organizations/${a.organization.id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300">
                        {a.organization.name}
                      </Link>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 whitespace-nowrap shrink-0">
                    {new Date(a.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

const EVENT_EMOJI: Record<string, string> = {
  lifecycle_changed:       "🔄",
  demo_scheduled:          "📅",
  demo_completed:          "✅",
  demo_cancelled:          "❌",
  trial_started:           "🚀",
  trial_activated_auto:    "⚡",
  trial_expired_auto:      "⏱️",
  non_conversion_logged:   "📋",
  crm_note_added:          "📝",
  subscription_converted:  "💳",
  subscription_cancelled:  "🚫",
  email_sent:              "📤",
  email_received:          "📥",
}

function EmailStatCard({ label, value, icon, color, href }: {
  label: string; value: number; icon: React.ReactNode; color: KpiColor; href: string
}) {
  const c = KPI_COLORS[color]
  return (
    <Link href={href} className={`bg-gray-900 border-l-4 border border-gray-800 ${c.border} rounded-xl p-5 hover:bg-gray-800/60 transition-colors block`}>
      <div className={`${c.icon} mt-0.5`}>{icon}</div>
      <p className={`text-3xl font-bold mt-3 leading-none ${c.value}`}>{value}</p>
      <p className="text-xs font-semibold text-white mt-2">{label}</p>
    </Link>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type KpiColor = "green" | "amber" | "red" | "blue" | "gray"

const KPI_COLORS: Record<KpiColor, { border: string; icon: string; value: string }> = {
  green: { border: "border-green-700",  icon: "text-green-400",  value: "text-green-300"  },
  amber: { border: "border-amber-700",  icon: "text-amber-400",  value: "text-amber-300"  },
  red:   { border: "border-red-800",    icon: "text-red-400",    value: "text-red-300"    },
  blue:  { border: "border-blue-800",   icon: "text-blue-400",   value: "text-blue-300"   },
  gray:  { border: "border-gray-700",   icon: "text-gray-400",   value: "text-gray-300"   },
}

function KpiCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: React.ReactNode; color: KpiColor; sub?: string
}) {
  const c = KPI_COLORS[color]
  return (
    <div className={`bg-gray-900 border-l-4 border border-gray-800 ${c.border} rounded-xl p-5`}>
      <div className="flex items-start justify-between">
        <div className={`${c.icon} mt-0.5`}>{icon}</div>
      </div>
      <p className={`text-3xl font-bold mt-3 leading-none ${c.value}`}>{value}</p>
      <p className="text-xs font-semibold text-white mt-2">{label}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

type AlertUrgency = "blue" | "red" | "amber" | "orange" | "gray"

const ALERT_COLORS: Record<AlertUrgency, { wrap: string; header: string; dot: string; empty: string }> = {
  blue:   { wrap: "border-blue-800",   header: "text-blue-300",   dot: "bg-blue-500",   empty: "text-blue-600"   },
  red:    { wrap: "border-red-800",    header: "text-red-300",    dot: "bg-red-500",    empty: "text-green-500"  },
  amber:  { wrap: "border-amber-800",  header: "text-amber-300",  dot: "bg-amber-500",  empty: "text-green-500"  },
  orange: { wrap: "border-orange-800", header: "text-orange-300", dot: "bg-orange-500", empty: "text-green-500"  },
  gray:   { wrap: "border-gray-700",   header: "text-gray-400",   dot: "bg-gray-500",   empty: "text-green-500"  },
}

function AlertCard({ title, count, icon, urgency, items, emptyText }: {
  title: string
  count: number
  icon: React.ReactNode
  urgency: AlertUrgency
  items: { label: string; sub?: string; href: string }[]
  emptyText: string
}) {
  const c = ALERT_COLORS[urgency]
  return (
    <div className={`bg-gray-900 border ${c.wrap} rounded-xl flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-800`}>
        <div className={`flex items-center gap-2 text-sm font-semibold ${c.header}`}>
          {icon}
          {title}
        </div>
        {count > 0 && (
          <span className={`text-xs font-bold text-white px-2 py-0.5 rounded-full ${c.dot}`}>
            {count}
          </span>
        )}
      </div>
      {/* Body */}
      <div className="flex-1 px-4 py-3 space-y-2 max-h-48 overflow-y-auto">
        {items.length === 0 ? (
          <p className={`text-xs ${c.empty} flex items-center gap-1`}>
            <span>✓</span> {emptyText}
          </p>
        ) : (
          items.map((item, i) => (
            <Link key={i} href={item.href}
              className="flex items-start justify-between gap-2 group">
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors leading-snug truncate">
                {item.label}
              </span>
              {item.sub && (
                <span className="text-xs text-gray-600 whitespace-nowrap shrink-0">{item.sub}</span>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

import { prisma } from "@/lib/prisma"
import Link from "next/link"

export const dynamic = "force-dynamic"

const EVENT_TYPES = [
  { key: "org_created",              label: "Orgs Created",          color: "bg-blue-500" },
  { key: "onboarding_completed",     label: "Completed Onboarding",  color: "bg-indigo-500" },
  { key: "first_issue_created",      label: "First Issue Logged",    color: "bg-emerald-500" },
  { key: "first_team_member_invited", label: "First Invite Sent",    color: "bg-yellow-500" },
  { key: "first_qr_code_created",    label: "First QR Code Created", color: "bg-purple-500" },
  { key: "trial_converted_to_paid",  label: "Converted to Paid",     color: "bg-rose-500" },
]

async function getActivationFunnel() {
  const counts = await Promise.all(
    EVENT_TYPES.map(({ key }) =>
      prisma.orgAnalyticsEvent.groupBy({
        by: ["organizationId"],
        where: { eventType: key },
        _count: true,
      }).then(rows => rows.length)
    )
  )
  return EVENT_TYPES.map((e, i) => ({ ...e, count: counts[i] }))
}

async function getRecentEvents() {
  return prisma.orgAnalyticsEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { organization: { select: { name: true, slug: true } } },
  })
}

export default async function AnalyticsFunnelPage() {
  const [funnel, recentEvents] = await Promise.all([
    getActivationFunnel(),
    getRecentEvents(),
  ])

  const orgCreatedCount = funnel[0]?.count ?? 1

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activation Funnel</h1>
        <p className="text-sm text-gray-500 mt-1">Unique organizations that reached each activation milestone (all time)</p>
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Activation Funnel</p>
        </div>
        <div className="divide-y divide-gray-100">
          {funnel.map((step, i) => {
            const pct = orgCreatedCount > 0 ? Math.round((step.count / orgCreatedCount) * 100) : 0
            return (
              <div key={step.key} className="flex items-center gap-4 px-5 py-4">
                <div className="w-6 text-sm font-bold text-gray-400 shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700">{step.label}</span>
                    <span className="text-sm font-bold text-gray-900">{step.count.toLocaleString()} orgs</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${step.color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">{pct}% of signups</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent events */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Recent Events</p>
        </div>
        {recentEvents.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No events recorded yet — events log as orgs activate.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentEvents.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 px-5 py-3">
                <div className="text-xs font-mono text-gray-400 w-36 shrink-0">{ev.createdAt.toISOString().slice(0, 16).replace("T", " ")}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-700">{ev.eventType}</span>
                  <span className="mx-2 text-gray-300">·</span>
                  <Link href={`/super-admin/organizations/${ev.organization.slug}`} className="text-sm text-blue-600 hover:underline">
                    {ev.organization.name}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

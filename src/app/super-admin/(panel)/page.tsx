import { prisma } from "@/lib/prisma"
import { Building2, Users, Clock, CreditCard, TrendingUp, CalendarDays } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow, format, startOfMonth, subMonths } from "date-fns"
import { TestingActions } from "./testing-actions"

export const dynamic = "force-dynamic"

async function getStats() {
  const now = new Date()
  const startOfThisMonth = startOfMonth(now)
  const sixMonthsAgo = subMonths(startOfThisMonth, 5)

  const [
    totalOrgs,
    activeTrials,
    payingCustomers,
    expiredTrials,
    totalUsers,
    newOrgsThisMonth,
    recentOrgs,
    orgsByMonth,
    activeOrgsRevenue,
    newPayingThisMonth,
    churnedThisMonth,
  ] = await Promise.all([
    prisma.organization.count({ where: { isDemo: false } }),
    prisma.organization.count({
      where: { isDemo: false, subscriptionStatus: "trialing", trialEndsAt: { gt: now } },
    }),
    prisma.organization.count({ where: { isDemo: false, subscriptionStatus: "active" } }),
    prisma.organization.count({
      where: {
        isDemo: false,
        subscriptionStatus: "trialing",
        trialEndsAt: { lt: now },
        NOT: { trialEndsAt: null },
      },
    }),
    prisma.user.count({ where: { organization: { isDemo: false } } }),
    prisma.organization.count({ where: { isDemo: false, createdAt: { gte: startOfThisMonth } } }),
    prisma.organization.findMany({
      where: { isDemo: false },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, name: true, createdAt: true, subscriptionStatus: true,
        trialEndsAt: true, _count: { select: { users: true } },
      },
    }),
    prisma.organization.findMany({
      where: { isDemo: false, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.organization.aggregate({
      where: { isDemo: false, subscriptionStatus: "active" },
      _sum: { monthlyTotalAfterDiscount: true },
    }),
    prisma.organization.count({
      where: { isDemo: false, subscriptionStatus: "active", updatedAt: { gte: startOfThisMonth } },
    }),
    prisma.organization.count({
      where: { isDemo: false, subscriptionStatus: { in: ["canceled", "expired"] }, updatedAt: { gte: startOfThisMonth } },
    }),
  ])

  // Group signups by month label
  const monthMap: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const m = subMonths(now, i)
    monthMap[format(m, "MMM yyyy")] = 0
  }
  for (const org of orgsByMonth) {
    const key = format(new Date(org.createdAt), "MMM yyyy")
    if (key in monthMap) monthMap[key]++
  }

  const mrr = Math.round((activeOrgsRevenue._sum.monthlyTotalAfterDiscount ?? 0) * 100) / 100
  const arpu = payingCustomers > 0 ? Math.round(mrr / payingCustomers * 100) / 100 : 0

  return {
    totalOrgs, activeTrials, payingCustomers, expiredTrials,
    totalUsers, newOrgsThisMonth, recentOrgs,
    signupsByMonth: Object.entries(monthMap),
    mrr,
    arr: Math.round(mrr * 12 * 100) / 100,
    arpu,
    newPayingThisMonth,
    churnedThisMonth,
  }
}

function StatusBadge({ status, trialEndsAt }: { status: string; trialEndsAt: Date | null }) {
  if (status === "active") {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 font-medium">Active</span>
  }
  const now = new Date()
  if (status === "trialing" && trialEndsAt && trialEndsAt > now) {
    const days = Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000)
    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900 text-amber-300 font-medium">Trial · {days}d</span>
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-400 font-medium">Expired</span>
}

export default async function SuperAdminOverview() {
  const stats = await getStats()

  const statCards = [
    { label: "Total Organizations", value: stats.totalOrgs,       icon: Building2,   color: "text-indigo-400", bg: "bg-indigo-950" },
    { label: "Active Trials",       value: stats.activeTrials,    icon: Clock,       color: "text-amber-400",  bg: "bg-amber-950"  },
    { label: "Paying Customers",    value: stats.payingCustomers, icon: CreditCard,  color: "text-green-400",  bg: "bg-green-950"  },
    { label: "Expired Trials",      value: stats.expiredTrials,   icon: CalendarDays,color: "text-red-400",    bg: "bg-red-950"    },
    { label: "Total Users",         value: stats.totalUsers,      icon: Users,       color: "text-blue-400",   bg: "bg-blue-950"   },
    { label: "New This Month",      value: stats.newOrgsThisMonth,icon: TrendingUp,  color: "text-purple-400", bg: "bg-purple-950" },
  ]

  const maxSignups = Math.max(...stats.signupsByMonth.map(([, v]) => v), 1)

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-gray-400 mt-1 text-sm">All organizations across Relay</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-3xl font-bold text-white">{value}</div>
            <div className="text-sm text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Revenue dashboard */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 mb-6 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-800">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <h2 className="text-white font-semibold">Revenue</h2>
          <span className="text-xs text-gray-600 ml-1">active subscriptions only</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-gray-800 divide-y md:divide-y-0">
          {[
            { label: "MRR",              value: `$${stats.mrr.toLocaleString()}`,         sub: "monthly recurring" },
            { label: "ARR",              value: `$${stats.arr.toLocaleString()}`,          sub: "annual run rate" },
            { label: "ARPU",             value: `$${stats.arpu.toLocaleString()}`,         sub: "per customer" },
            { label: "New paying",       value: stats.newPayingThisMonth.toString(),       sub: "this month" },
            { label: "Churned",          value: stats.churnedThisMonth.toString(),         sub: "this month" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="px-6 py-4">
              <div className="text-xl font-bold text-white">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              <div className="text-[10px] text-gray-700 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <TestingActions />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent signups */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Recent Organizations</h2>
            <Link href="/super-admin/organizations" className="text-indigo-400 hover:text-indigo-300 text-sm">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {stats.recentOrgs.map((org) => (
              <Link
                key={org.id}
                href={`/super-admin/organizations/${org.id}`}
                className="flex items-center justify-between px-6 py-3 hover:bg-gray-800/50 transition-colors"
              >
                <div>
                  <p className="text-white text-sm font-medium">{org.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {org._count.users} user{org._count.users !== 1 ? "s" : ""} ·{" "}
                    {formatDistanceToNow(new Date(org.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <StatusBadge status={org.subscriptionStatus} trialEndsAt={org.trialEndsAt} />
              </Link>
            ))}
          </div>
        </div>

        {/* Signups by month */}
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Signups (6 months)</h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            {stats.signupsByMonth.map(([month, count]) => (
              <div key={month}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">{month}</span>
                  <span className="text-xs font-semibold text-white">{count}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${(count / maxSignups) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

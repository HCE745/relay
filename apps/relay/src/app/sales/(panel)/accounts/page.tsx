import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Building2, Mail, Calendar, ChevronRight, Search } from "lucide-react"
import { computeEngagementScore, scoreLabel, scoreColor } from "@/lib/engagement-score"

export const dynamic = "force-dynamic"

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const STATUS_COLORS: Record<string, string> = {
  Scheduled:    "bg-blue-900/40 text-blue-300",
  Completed:    "bg-emerald-900/40 text-emerald-300",
  "No-Show":    "bg-red-900/40 text-red-300",
  Cancelled:    "bg-gray-800 text-gray-400",
  "Follow-Up":  "bg-amber-900/40 text-amber-300",
}

export default async function AccountsPage() {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) redirect("/sales/login")

  const isManager = session?.superAdmin || session?.salesUserRole === "admin_sales"
  const repFilter = isManager ? {} : { assignedToId: session?.salesUserId ?? "" }

  const calls = await prisma.demoCall.findMany({
    where: repFilter,
    orderBy: { updatedAt: "desc" },
    include: {
      assignedTo:    { select: { id: true, name: true } },
      organization:  { select: { id: true, name: true, subscriptionStatus: true, plan: true } },
      opportunities: { select: { id: true, stage: true, value: true }, orderBy: { createdAt: "desc" }, take: 1 },
      crmEmails:     {
        select: { createdAt: true, direction: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  // Compute engagement scores per call (batched: get link clicks for each email)
  const emailSet = [...new Set(calls.map(c => c.contactEmail.toLowerCase()))]
  const clickRows = await prisma.linkClick.findMany({
    where: {
      isBotSuspected: false,
      crmEmail: { contactEmail: { in: emailSet } },
    },
    select: {
      clickCount: true,
      crmEmail: { select: { contactEmail: true, openedAt: true } },
      events: {
        where: { isBotSuspected: false },
        select: { eventType: true, isBotSuspected: true, createdAt: true },
      },
    },
  })

  const openCounts = await prisma.crmEmail.groupBy({
    by: ["contactEmail"],
    where: {
      contactEmail: { in: emailSet },
      openedAt: { not: null },
    },
    _count: { id: true },
  })

  const scoreByEmail: Record<string, { score: number; label: string; color: string }> = {}
  for (const email of emailSet) {
    const rows     = clickRows.filter(r => r.crmEmail?.contactEmail?.toLowerCase() === email)
    const allEvts  = rows.flatMap(r => r.events)
    const openCnt  = openCounts.find(o => o.contactEmail?.toLowerCase() === email)?._count?.id ?? 0
    const hasClick = rows.some(r => r.clickCount > 0)
    const score    = computeEngagementScore(allEvts, openCnt, hasClick)
    scoreByEmail[email] = { score, label: scoreLabel(score), color: scoreColor(score) }
  }

  return (
    <div className="p-6 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Accounts</h1>
        <p className="text-gray-400 text-sm mt-0.5">{calls.length} accounts</p>
      </div>

      {calls.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No accounts yet.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Open Deal</th>
                  <th className="px-4 py-3 font-medium">Engagement</th>
                  <th className="px-4 py-3 font-medium">Last Activity</th>
                  <th className="px-4 py-3 font-medium">Rep</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {calls.map(call => {
                  const eng  = scoreByEmail[call.contactEmail.toLowerCase()] ?? { score: 0, label: "Low", color: "text-gray-400" }
                  const opp  = call.opportunities[0]
                  const last = call.crmEmails[0]?.createdAt ?? call.updatedAt
                  const org  = call.organization

                  return (
                    <tr key={call.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{call.companyName}</p>
                            {org && (
                              <p className="text-xs text-emerald-400">{org.plan} · {org.subscriptionStatus}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white">{call.contactName}</p>
                        <p className="text-gray-500 text-xs">{call.contactEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[call.callStatus] ?? "bg-gray-800 text-gray-400"}`}>
                          {call.callStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {opp ? (
                          <span className="text-gray-300 text-xs">{opp.stage}</span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${eng.color}`}>{eng.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(last)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{call.assignedTo?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/sales/accounts/${call.id}`} className="text-gray-500 hover:text-white transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

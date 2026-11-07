import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { Building2 } from "lucide-react"
import { computeEngagementScore, scoreLabel, scoreColor } from "@/lib/engagement-score"
import { AccountsTable } from "./AccountsTable"

export const dynamic = "force-dynamic"


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
        <h1 className="text-2xl font-bold text-white">My Accounts</h1>
        <p className="text-gray-400 text-sm mt-0.5">{calls.length} demo calls assigned to you</p>
      </div>

      {calls.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No accounts yet.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <AccountsTable
              accounts={calls.map(call => ({
                ...call,
                engagement: scoreByEmail[call.contactEmail.toLowerCase()] ?? { score: 0, label: "Low", color: "text-gray-400" },
              }))}
            />
          </div>
        </div>
      )}
    </div>
  )
}

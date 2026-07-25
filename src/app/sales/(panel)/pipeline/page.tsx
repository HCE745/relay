import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow, differenceInDays } from "date-fns"
import { Building2, Calendar, Clock, AlertCircle, CheckCircle2 } from "lucide-react"

export const dynamic = "force-dynamic"

const STAGES: { key: string; label: string; color: string; border: string; badge: string }[] = [
  { key: "New Lead",        label: "New Lead",        color: "text-blue-400",   border: "border-blue-900/50",   badge: "bg-blue-900/40 text-blue-300" },
  { key: "Pending",         label: "Pending",         color: "text-yellow-400", border: "border-yellow-900/50", badge: "bg-yellow-900/40 text-yellow-300" },
  { key: "Scheduled",       label: "Demo Scheduled",  color: "text-indigo-400", border: "border-indigo-900/50", badge: "bg-indigo-900/40 text-indigo-300" },
  { key: "Demo Completed",  label: "Demo Completed",  color: "text-purple-400", border: "border-purple-900/50", badge: "bg-purple-900/40 text-purple-300" },
  { key: "Trial Active",    label: "Trial Active",    color: "text-emerald-400",border: "border-emerald-900/50",badge: "bg-emerald-900/40 text-emerald-300" },
  { key: "Trial Expired",   label: "Trial Expired",   color: "text-orange-400", border: "border-orange-900/50", badge: "bg-orange-900/40 text-orange-300" },
  { key: "Converted",       label: "Converted",       color: "text-green-400",  border: "border-green-900/50",  badge: "bg-green-900/40 text-green-300" },
  { key: "Lost",            label: "Lost",            color: "text-gray-500",   border: "border-gray-800",      badge: "bg-gray-800 text-gray-400" },
]

export default async function PipelinePage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const now = new Date()

  const calls = await prisma.demoCall.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id:           true,
      contactName:  true,
      contactEmail: true,
      companyName:  true,
      industry:     true,
      callStatus:   true,
      scheduledAt:  true,
      followUpDate: true,
      updatedAt:    true,
      createdAt:    true,
      organization: { select: { id: true, name: true, lifecycleStatus: true } },
      crmEmails:    { select: { id: true }, where: { direction: "sent" } },
    },
  })

  // Group by stage
  const grouped = new Map<string, typeof calls>()
  for (const stage of STAGES) grouped.set(stage.key, [])

  for (const call of calls) {
    const status = call.callStatus ?? "New Lead"
    if (grouped.has(status)) {
      grouped.get(status)!.push(call)
    } else {
      // Unknown status → put in New Lead
      grouped.get("New Lead")!.push(call)
    }
  }

  const totalActive = calls.filter(c =>
    !["Converted", "Lost"].includes(c.callStatus ?? "")
  ).length

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Pipeline</h1>
            <p className="text-gray-400 text-sm mt-0.5">{totalActive} active leads</p>
          </div>
          <Link
            href="/super-admin/crm/demo-calls"
            className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2"
          >
            Manage in CRM ↗
          </Link>
        </div>
      </div>

      {/* Kanban scroll container */}
      <div className="flex gap-4 overflow-x-auto pb-6" style={{ minHeight: "calc(100vh - 160px)" }}>
        {STAGES.map(stage => {
          const items = grouped.get(stage.key) ?? []
          return (
            <div key={stage.key} className="flex-shrink-0 w-72">
              {/* Column header */}
              <div className={`flex items-center gap-2 mb-3 px-1`}>
                <h2 className={`text-sm font-semibold ${stage.color}`}>{stage.label}</h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.badge}`}>
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {items.map(call => {
                  const daysInStage = differenceInDays(now, call.updatedAt)
                  const followUpDue = call.followUpDate && call.followUpDate < now
                  const emailCount  = call.crmEmails.length

                  return (
                    <Link
                      key={call.id}
                      href={`/super-admin/crm/demo-calls/${call.id}`}
                      className={`block bg-gray-900 border ${stage.border} rounded-xl p-3.5 hover:bg-gray-800/80 transition-colors group`}
                    >
                      {/* Company */}
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white leading-tight group-hover:text-emerald-300 transition-colors truncate">
                            {call.companyName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{call.contactName}</p>
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="space-y-1 mt-2">
                        {call.industry && (
                          <p className="text-xs text-gray-500">{call.industry}</p>
                        )}

                        {call.scheduledAt && (
                          <div className="flex items-center gap-1 text-xs text-indigo-400">
                            <Calendar className="w-3 h-3" />
                            {call.scheduledAt < now ? "Demo was " : "Demo "}
                            {formatDistanceToNow(call.scheduledAt, { addSuffix: true })}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Clock className="w-3 h-3" />
                            {daysInStage === 0 ? "Today" : `${daysInStage}d in stage`}
                          </div>
                          {emailCount > 0 && (
                            <span className="text-xs text-gray-600">{emailCount} email{emailCount !== 1 ? "s" : ""}</span>
                          )}
                        </div>

                        {followUpDue && (
                          <div className="flex items-center gap-1 text-xs text-orange-400 mt-1">
                            <AlertCircle className="w-3 h-3" />
                            Follow-up overdue
                          </div>
                        )}

                        {call.organization && (
                          <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {call.organization.name}
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}

                {items.length === 0 && (
                  <div className="text-center py-6 text-gray-700 text-xs border border-dashed border-gray-800 rounded-xl">
                    No leads
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

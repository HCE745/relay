import { redirect } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"
import { Activity } from "lucide-react"

export const dynamic = "force-dynamic"

function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function fmtActivityType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

const ACTIVITY_COLORS: Record<string, string> = {
  email_sent:          "bg-blue-500",
  email_opened:        "bg-blue-400",
  email_replied:       "bg-blue-300",
  demo_booked:         "bg-amber-500",
  demo_completed:      "bg-amber-400",
  prospect_added:      "bg-emerald-600",
  prospect_contacted:  "bg-emerald-500",
  opportunity_created: "bg-purple-500",
  task_completed:      "bg-teal-500",
  note_added:          "bg-gray-500",
}

export default async function RepViewActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ repId: string }>
  searchParams: Promise<{ days?: string }>
}) {
  const { repId } = await params
  const { days: daysStr = "30" } = await searchParams

  const view = await getManagerRepView(repId)
  if (!view) redirect("/sales/manager/rep-view")

  const days = Math.min(90, Math.max(7, parseInt(daysStr, 10) || 30))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const activities = await prisma.salesCrmActivity.findMany({
    where: {
      salesUserId: repId,
      occurredAt: { gte: since },
    },
    select: {
      id: true,
      activityType: true,
      occurredAt: true,
      metadata: true,
    },
    orderBy: { occurredAt: "desc" },
    take: 200,
  })

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Activity</h2>
          <p className="text-xs text-gray-500 mt-0.5">{activities.length} events in last {days} days</p>
        </div>
        <div className="flex items-center gap-1">
          {[7, 30, 90].map(d => (
            <a
              key={d}
              href={`?days=${d}`}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                days === d ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {d}d
            </a>
          ))}
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-6 py-10 text-center">
          <Activity className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No activity in this period.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[9px] top-0 bottom-0 w-px bg-gray-800" />

          <div className="space-y-1 pl-7">
            {activities.map(a => {
              const dotColor = ACTIVITY_COLORS[a.activityType] ?? "bg-gray-600"
              return (
                <div key={a.id} className="relative flex items-start gap-4 py-2.5">
                  {/* Dot */}
                  <div className={`absolute -left-7 mt-1.5 w-[9px] h-[9px] rounded-full shrink-0 ${dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300">{fmtActivityType(a.activityType)}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{fmtDateTime(a.occurredAt)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

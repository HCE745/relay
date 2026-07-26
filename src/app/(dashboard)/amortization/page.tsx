import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, CalendarClock } from "lucide-react"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { EmptyState } from "@/components/ui/EmptyState"
import { AmortizationListActions } from "./AmortizationListActions"

export const dynamic = "force-dynamic"

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export default async function AmortizationPage() {
  const { tenantId, entityId } = await getEntityContext()

  const schedules = await prisma.amortizationSchedule.findMany({
    where: { tenantId, entityId },
    include: {
      entries: { select: { id: true, posted: true, periodDate: true, scheduleId: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const today = new Date()
  const dueEntries = schedules
    .filter((s) => s.status === "ACTIVE")
    .flatMap((s) => s.entries.filter((e) => !e.posted && e.periodDate <= today))

  return (
    <div className="p-6 max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Amortization Schedules</h1>
          <p className="page-subtitle">
            {schedules.length > 0
              ? `${schedules.length} schedule${schedules.length !== 1 ? "s" : ""}${dueEntries.length > 0 ? ` · ${dueEntries.length} entr${dueEntries.length !== 1 ? "ies" : "y"} due` : ""}`
              : "Spread prepaid expenses over their coverage period"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AmortizationListActions dueEntries={dueEntries} />
          <Link href="/amortization/new" className="btn-primary">
            <Plus className="w-3.5 h-3.5" /> New Schedule
          </Link>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th className="num">Total</th>
              <th className="num">Months</th>
              <th>Start Date</th>
              <th>Progress</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No amortization schedules"
                description="Create a schedule to spread a prepaid expense (annual software, insurance, retainers) over its coverage months. Each month-end, post the entry to move cost from Prepaid Asset to Expense."
                actions={[{ label: "New Schedule", href: "/amortization/new" }]}
              />
            ) : schedules.map((s) => {
              const posted = s.entries.filter((e) => e.posted).length
              const total = s.entries.length
              const pct = total > 0 ? Math.round((posted / total) * 100) : 0
              return (
                <tr key={s.id}>
                  <td className="font-medium">
                    <Link href={`/amortization/${s.id}`} className="text-blue-700 hover:text-blue-800">
                      {s.name}
                    </Link>
                  </td>
                  <td><StatusBadge status={s.type} /></td>
                  <td className="num fin">{fmt(s.totalAmountCents)}</td>
                  <td className="num text-slate-500">{s.months}</td>
                  <td className="fin text-slate-500">{s.startDate.toISOString().slice(0, 10)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5 min-w-[4rem]">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{posted}/{total}</span>
                    </div>
                  </td>
                  <td><StatusBadge status={s.status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

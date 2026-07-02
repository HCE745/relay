import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus } from "lucide-react"
import { AmortizationListActions } from "./AmortizationListActions"

export const dynamic = "force-dynamic"

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    ACTIVE: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    VOIDED: "bg-gray-100 text-gray-400",
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100"}`}>
      {status}
    </span>
  )
}

function typeBadge(type: string) {
  const labels: Record<string, string> = {
    PREPAID_EXPENSE: "Prepaid",
    DEFERRED_REVENUE: "Deferred Rev",
  }
  const colors: Record<string, string> = {
    PREPAID_EXPENSE: "bg-orange-100 text-orange-700",
    DEFERRED_REVENUE: "bg-purple-100 text-purple-700",
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[type] ?? "bg-gray-100"}`}>
      {labels[type] ?? type}
    </span>
  )
}

function fmt(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
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
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Amortization Schedules</h1>
        <div className="flex items-center gap-3">
          <AmortizationListActions dueEntries={dueEntries} />
          <Link
            href="/amortization/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" /> New Schedule
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Total</th>
              <th>Months</th>
              <th>Start Date</th>
              <th>Progress</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400">
                  No amortization schedules — create one to get started.
                </td>
              </tr>
            )}
            {schedules.map((s) => {
              const posted = s.entries.filter((e) => e.posted).length
              const total = s.entries.length
              return (
                <tr key={s.id}>
                  <td className="font-medium">
                    <Link href={`/amortization/${s.id}`} className="text-blue-600 hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td>{typeBadge(s.type)}</td>
                  <td className="font-mono text-sm">{fmt(s.totalAmountCents)}</td>
                  <td className="text-gray-600 text-sm">{s.months}</td>
                  <td className="text-gray-600 text-sm">{s.startDate.toISOString().slice(0, 10)}</td>
                  <td className="text-sm text-gray-600">{posted} / {total}</td>
                  <td>{statusBadge(s.status)}</td>
                  <td>
                    <Link href={`/amortization/${s.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      View
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

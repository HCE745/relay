import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { AmortizationDetailActions } from "./AmortizationDetailActions"

export const dynamic = "force-dynamic"

function fmt(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
}

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

export default async function AmortizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await getEntityContext()

  const schedule = await prisma.amortizationSchedule.findFirst({
    where: { id, tenantId },
    include: { entries: { orderBy: { periodNumber: "asc" } } },
  })

  if (!schedule) notFound()

  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const unposted = schedule.entries.filter((e) => !e.posted)
  const dueUnposted = unposted.filter((e) => e.periodDate <= today)
  const postedCount = schedule.entries.filter((e) => e.posted).length

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/amortization" className="text-sm text-blue-600 hover:underline">&larr; Amortization</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{schedule.name}</h1>
        </div>
        <AmortizationDetailActions
          scheduleId={schedule.id}
          dueCount={dueUnposted.length}
          unpostedPeriods={unposted.map((e) => e.periodNumber)}
          disabled={schedule.status !== "ACTIVE"}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Schedule Details</h2>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Type</dt>
            <dd className="font-medium text-gray-900">{schedule.type === "PREPAID_EXPENSE" ? "Prepaid Expense" : "Deferred Revenue"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Total Amount</dt>
            <dd className="font-medium font-mono text-gray-900">{fmt(schedule.totalAmountCents)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Months</dt>
            <dd className="font-medium text-gray-900">{schedule.months}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Start Date</dt>
            <dd className="font-medium text-gray-900">{schedule.startDate.toISOString().slice(0, 10)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Progress</dt>
            <dd className="font-medium text-gray-900">{postedCount} / {schedule.entries.length} posted</dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd>{statusBadge(schedule.status)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">BS Account</dt>
            <dd className="font-mono text-xs text-gray-700">{schedule.bsAccountId}</dd>
          </div>
          <div>
            <dt className="text-gray-500">P&L Account</dt>
            <dd className="font-mono text-xs text-gray-700">{schedule.plAccountId}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Amortization Entries</h2>
          <span className="text-xs text-gray-500">{dueUnposted.length} due today</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Period Date</th>
              <th className="text-right">Amount</th>
              <th>Status</th>
              <th>Posted At</th>
              <th>Journal Entry</th>
            </tr>
          </thead>
          <tbody>
            {schedule.entries.map((e) => {
              const isDue = !e.posted && e.periodDate <= today
              return (
                <tr key={e.id} className={isDue ? "bg-yellow-50" : ""}>
                  <td className="text-gray-500">{e.periodNumber}</td>
                  <td>{e.periodDate.toISOString().slice(0, 10)}</td>
                  <td className="text-right font-mono">{fmt(e.amountCents)}</td>
                  <td>
                    {e.posted ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Posted</span>
                    ) : isDue ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Due</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">Pending</span>
                    )}
                  </td>
                  <td className="text-gray-500 text-sm">
                    {e.postedAt ? e.postedAt.toISOString().slice(0, 16).replace("T", " ") : "—"}
                  </td>
                  <td className="font-mono text-xs text-gray-500">
                    {e.journalEntryId ? e.journalEntryId.slice(0, 12) + "…" : "—"}
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

import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { RecurringDetailActions } from "./RecurringDetailActions"

export const dynamic = "force-dynamic"

export default async function RecurringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await getEntityContext()

  const template = await prisma.recurringTemplate.findFirst({
    where: { id, tenantId },
    include: { runs: { orderBy: { runAt: "desc" }, take: 50 } },
  })

  if (!template) notFound()

  const payload = template.payload as {
    vendorId?: string
    customerId?: string
    apAccountId?: string
    arAccountId?: string
    lines: { accountId: string; description?: string; amount?: number; debit?: number; credit?: number }[]
    memo?: string
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/recurring" className="text-sm text-blue-600 hover:underline">&larr; Recurring</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{template.name}</h1>
        </div>
        <RecurringDetailActions templateId={template.id} active={template.active} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Details</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Type</dt>
            <dd className="font-medium text-gray-900">{template.type}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Frequency</dt>
            <dd className="font-medium text-gray-900">{template.frequency}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Start Date</dt>
            <dd className="font-medium text-gray-900">{template.startDate.toISOString().slice(0, 10)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">End Date</dt>
            <dd className="font-medium text-gray-900">{template.endDate?.toISOString().slice(0, 10) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Next Run Date</dt>
            <dd className="font-medium text-gray-900">{template.nextRunDate.toISOString().slice(0, 10)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className={`font-medium ${template.active ? "text-green-700" : "text-gray-400"}`}>
              {template.active ? "Active" : "Paused"}
            </dd>
          </div>
          {payload.memo && (
            <div className="col-span-2">
              <dt className="text-gray-500">Memo</dt>
              <dd className="font-medium text-gray-900">{payload.memo}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Lines</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Account ID</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {payload.lines.map((l, i) => (
              <tr key={i}>
                <td>{l.description ?? "—"}</td>
                <td className="font-mono text-xs text-gray-500">{l.accountId}</td>
                <td className="text-right font-mono">
                  {l.amount != null ? `$${(l.amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Run History</h2>
        {template.runs.length === 0 ? (
          <p className="text-sm text-gray-400">No runs yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Period Start</th>
                <th>Run At</th>
                <th>Source Type</th>
                <th>Source ID</th>
              </tr>
            </thead>
            <tbody>
              {template.runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.periodStart.toISOString().slice(0, 10)}</td>
                  <td>{run.runAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td>{run.sourceType ?? "—"}</td>
                  <td className="font-mono text-xs text-gray-500">{run.sourceId?.slice(0, 12) ?? "—"}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

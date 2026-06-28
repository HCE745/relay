import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function IntercompanyPage() {
  const { tenantId, entityId } = await getEntityContext()

  const icEntries = await prisma.journalEntry.findMany({
    where: { tenantId, entityId, isIntercompany: true, status: "POSTED" },
    include: {
      lines: { include: { account: true } },
    },
    orderBy: { date: "desc" },
    take: 50,
  })

  // Get all entities for counterparty labels
  const entities = await prisma.entity.findMany({ where: { tenantId } })
  const entityMap = new Map(entities.map((e) => [e.id, e.name]))

  function fmt(cents: number) {
    return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Intercompany Transactions</h1>
        <p className="text-sm text-gray-500">Matched-pair entries linking entities within HCE Holdings</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Memo</th><th>Counterparty</th>
              <th>Group ID</th><th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {icEntries.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  No intercompany transactions yet
                </td>
              </tr>
            )}
            {icEntries.map((e) => {
              const debit = e.lines.reduce((s, l) => s + l.debit, 0)
              return (
                <tr key={e.id}>
                  <td className="text-gray-500 text-xs">{e.date.toISOString().slice(0, 10)}</td>
                  <td className="font-medium">{e.memo ?? "—"}</td>
                  <td className="text-gray-500">{e.counterpartyEntityId ? entityMap.get(e.counterpartyEntityId) : "—"}</td>
                  <td className="font-mono text-xs text-gray-400">{e.intercompanyGroupId?.slice(0, 8)}…</td>
                  <td className="text-right font-mono">{fmt(debit)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800">
        <strong>How intercompany works:</strong> Each transaction creates a matched pair of journal entries
        sharing an <code className="bg-blue-100 px-1 rounded">intercompanyGroupId</code>.
        Consolidated reports automatically eliminate these pairs to prevent double-counting.
      </div>
    </div>
  )
}

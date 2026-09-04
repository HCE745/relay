import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { ArrowLeftRight } from "lucide-react"
import { EmptyCard } from "@/components/ui/EmptyState"

export const dynamic = "force-dynamic"

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export default async function IntercompanyPage() {
  const { tenantId, entityId } = await getEntityContext()

  const icEntries = await prisma.journalEntry.findMany({
    where: { tenantId, entityId, isIntercompany: true, status: "POSTED" },
    include: { lines: { include: { account: true } } },
    orderBy: { date: "desc" },
    take: 50,
  })

  const entities = await prisma.entity.findMany({ where: { tenantId } })
  const entityMap = new Map(entities.map((e) => [e.id, e.name]))

  return (
    <div className="p-6 max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Intercompany Transactions</h1>
          <p className="page-subtitle">Matched-pair entries linking entities within HCE Holdings</p>
        </div>
      </div>

      <div className="card">
        {icEntries.length === 0 ? (
          <EmptyCard
            icon={ArrowLeftRight}
            title="No intercompany transactions"
            description="Intercompany entries are created when you post a journal entry marked as intercompany. Each creates a matched pair that consolidation reports automatically eliminate."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Memo</th>
                <th>Counterparty</th>
                <th>Group ID</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {icEntries.map((e) => {
                const debit = e.lines.reduce((s, l) => s + l.debit, 0)
                return (
                  <tr key={e.id}>
                    <td className="fin text-slate-500">{e.date.toISOString().slice(0, 10)}</td>
                    <td className="font-medium">{e.memo ?? "—"}</td>
                    <td className="text-slate-500">{e.counterpartyEntityId ? entityMap.get(e.counterpartyEntityId) : "—"}</td>
                    <td className="fin text-slate-400 text-xs">{e.intercompanyGroupId?.slice(0, 8)}…</td>
                    <td className="num fin">{fmt(debit)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card p-5">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text-base)" }}>How intercompany works:</strong>{" "}
          Each transaction creates a matched pair of journal entries sharing an intercompanyGroupId.
          Consolidated reports automatically eliminate these pairs to prevent double-counting.
        </p>
      </div>
    </div>
  )
}

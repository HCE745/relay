import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, RefreshCw } from "lucide-react"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { EmptyState } from "@/components/ui/EmptyState"
import { RecurringActions } from "./RecurringActions"

export const dynamic = "force-dynamic"

const TYPE_BADGE: Record<string, string> = {
  BILL: "badge-orange",
  INVOICE: "badge-blue",
  JOURNAL: "badge-purple",
}

export default async function RecurringPage() {
  const { tenantId, entityId } = await getEntityContext()

  const templates = await prisma.recurringTemplate.findMany({
    where: { tenantId, entityId },
    include: { _count: { select: { runs: true } } },
    orderBy: { createdAt: "desc" },
  })

  const due = templates.filter((t) => t.active && t.nextRunDate <= new Date())

  return (
    <div className="p-6 max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Recurring Entries</h1>
          <p className="page-subtitle">
            {templates.length > 0
              ? `${templates.length} template${templates.length !== 1 ? "s" : ""}${due.length > 0 ? ` · ${due.length} due` : ""}`
              : "Automate bills, invoices, and journal entries on a schedule"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RecurringActions templates={due} />
          <Link href="/recurring/new" className="btn-primary">
            <Plus className="w-3.5 h-3.5" /> New Template
          </Link>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Frequency</th>
              <th>Next Run</th>
              <th className="num">Runs</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <EmptyState
                icon={RefreshCw}
                title="No recurring templates"
                description="Create a template to automate bills, invoices, or journal entries on a daily, weekly, or monthly schedule."
                actions={[{ label: "New Template", href: "/recurring/new" }]}
              />
            ) : templates.map((t) => (
              <tr key={t.id}>
                <td className="font-medium">
                  <Link href={`/recurring/${t.id}`} className="text-blue-700 hover:text-blue-800">
                    {t.name}
                  </Link>
                </td>
                <td>
                  <span className={`badge ${TYPE_BADGE[t.type] ?? "badge-gray"}`}>
                    {t.type.charAt(0) + t.type.slice(1).toLowerCase()}
                  </span>
                </td>
                <td className="text-slate-600 capitalize">
                  {t.frequency.charAt(0) + t.frequency.slice(1).toLowerCase()}
                </td>
                <td className="fin text-slate-500">{t.nextRunDate.toISOString().slice(0, 10)}</td>
                <td className="num text-slate-500">{t._count.runs}</td>
                <td>
                  <StatusBadge status={t.active ? "ACTIVE" : "VOID"} label={t.active ? "Active" : "Paused"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

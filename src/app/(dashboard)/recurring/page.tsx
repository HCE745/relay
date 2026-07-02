import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus } from "lucide-react"
import { RecurringActions } from "./RecurringActions"

export const dynamic = "force-dynamic"

function typeBadge(type: string) {
  const colors: Record<string, string> = {
    BILL: "bg-orange-100 text-orange-700",
    INVOICE: "bg-blue-100 text-blue-700",
    JOURNAL: "bg-purple-100 text-purple-700",
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[type] ?? "bg-gray-100 text-gray-600"}`}>
      {type}
    </span>
  )
}

function activeBadge(active: boolean) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
      {active ? "Active" : "Paused"}
    </span>
  )
}

export default async function RecurringPage() {
  const { tenantId, entityId } = await getEntityContext()

  const templates = await prisma.recurringTemplate.findMany({
    where: { tenantId, entityId },
    include: { _count: { select: { runs: true } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Recurring Entries</h1>
        <div className="flex items-center gap-3">
          <RecurringActions templates={templates.filter((t) => t.active && t.nextRunDate <= new Date())} />
          <Link
            href="/recurring/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" /> New Template
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Frequency</th>
              <th>Next Run</th>
              <th>Runs</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400">
                  No recurring templates — create one to get started.
                </td>
              </tr>
            )}
            {templates.map((t) => (
              <tr key={t.id}>
                <td className="font-medium">
                  <Link href={`/recurring/${t.id}`} className="text-blue-600 hover:underline">
                    {t.name}
                  </Link>
                </td>
                <td>{typeBadge(t.type)}</td>
                <td className="text-gray-600 text-sm capitalize">{t.frequency.charAt(0) + t.frequency.slice(1).toLowerCase()}</td>
                <td className="text-gray-600 text-sm">{t.nextRunDate.toISOString().slice(0, 10)}</td>
                <td className="text-gray-600 text-sm">{t._count.runs}</td>
                <td>{activeBadge(t.active)}</td>
                <td>
                  <Link href={`/recurring/${t.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { ensureFixedAssetAccounts } from "@/lib/fixed-assets"
import Link from "next/link"
import { Plus } from "lucide-react"

export const dynamic = "force-dynamic"

function fmt(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  FULLY_DEPRECIATED: "bg-gray-100 text-gray-500",
  DISPOSED: "bg-red-100 text-red-500",
}

const CATEGORY_LABELS: Record<string, string> = {
  EQUIPMENT: "Equipment",
  VEHICLE: "Vehicle",
  FURNITURE: "Furniture",
  COMPUTER: "Computer",
  BUILDING: "Building",
  OTHER: "Other",
}

export default async function FixedAssetsPage() {
  const { tenantId, entityId } = await getEntityContext()

  await ensureFixedAssetAccounts(tenantId, entityId)

  const assets = await prisma.fixedAsset.findMany({
    where: { tenantId, entityId },
    include: {
      depreciationEntries: { where: { status: "POSTED" }, select: { amountCents: true } },
    },
    orderBy: { acquisitionDate: "desc" },
  })

  const rows = assets.map((a) => {
    const accum = a.depreciationEntries.reduce((s, e) => s + e.amountCents, 0)
    return { ...a, accum, nbv: a.costCents - accum }
  })

  const totalCost = rows.reduce((s, r) => s + r.costCents, 0)
  const totalAccum = rows.reduce((s, r) => s + r.accum, 0)
  const totalNbv = totalCost - totalAccum

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fixed Assets</h1>
          <p className="text-sm text-gray-500 mt-0.5">{rows.length} asset{rows.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/fixed-assets/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> New Asset
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">No fixed assets yet.</p>
            <Link href="/fixed-assets/new" className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add your first asset
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Category</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Cost</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Accum. Dep.</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Net Book Value</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">In Service</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/fixed-assets/${a.id}`} className="font-medium text-blue-600 hover:underline">
                        {a.name}
                      </Link>
                      {a.description && <p className="text-xs text-gray-400 mt-0.5">{a.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{CATEGORY_LABELS[a.category] ?? a.category}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{fmt(a.costCents)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-orange-600">({fmt(a.accum)})</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold">{fmt(a.nbv)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{a.inServiceDate.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status] ?? ""}`}>
                        {a.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td colSpan={2} className="px-5 py-3 text-sm text-gray-700">Total ({rows.length} assets)</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">{fmt(totalCost)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-orange-600">({fmt(totalAccum)})</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">{fmt(totalNbv)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

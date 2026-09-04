import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { ensureFixedAssetAccounts } from "@/lib/fixed-assets"
import Link from "next/link"
import { Plus, Truck } from "lucide-react"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { EmptyState } from "@/components/ui/EmptyState"

export const dynamic = "force-dynamic"

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
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
    <div className="p-6 max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fixed Assets</h1>
          <p className="page-subtitle">
            {rows.length > 0
              ? `${rows.length} asset${rows.length !== 1 ? "s" : ""} · Net book value ${fmt(totalNbv)}`
              : "Track depreciable assets and their book value over time"}
          </p>
        </div>
        <Link href="/fixed-assets/new" className="btn-primary">
          <Plus className="w-3.5 h-3.5" /> New Asset
        </Link>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th className="num">Cost</th>
              <th className="num">Accum. Dep.</th>
              <th className="num">Net Book Value</th>
              <th>In Service</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyState
                icon={Truck}
                title="No fixed assets"
                description="Add equipment, vehicles, or buildings to track their cost, depreciation schedule, and current net book value."
                actions={[{ label: "New Asset", href: "/fixed-assets/new" }]}
              />
            ) : rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/fixed-assets/${a.id}`} className="font-medium text-blue-700 hover:text-blue-800">
                    {a.name}
                  </Link>
                  {a.description && <p className="text-xs text-slate-400 mt-0.5">{a.description}</p>}
                </td>
                <td className="text-slate-500">{CATEGORY_LABELS[a.category] ?? a.category}</td>
                <td className="num fin">{fmt(a.costCents)}</td>
                <td className="num fin text-amber-600">({fmt(a.accum)})</td>
                <td className="num fin font-semibold">{fmt(a.nbv)}</td>
                <td className="fin text-slate-500">{a.inServiceDate.toISOString().slice(0, 10)}</td>
                <td>
                  <StatusBadge
                    status={a.status === "FULLY_DEPRECIATED" ? "COMPLETED" : a.status === "DISPOSED" ? "VOID" : "ACTIVE"}
                    label={a.status.replace(/_/g, " ")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border)", background: "var(--background)" }}>
                <td colSpan={2} className="font-semibold text-sm px-5 py-3" style={{ color: "var(--text-base)" }}>
                  Total ({rows.length} assets)
                </td>
                <td className="num fin font-semibold">{fmt(totalCost)}</td>
                <td className="num fin font-semibold text-amber-600">({fmt(totalAccum)})</td>
                <td className="num fin font-semibold">{fmt(totalNbv)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

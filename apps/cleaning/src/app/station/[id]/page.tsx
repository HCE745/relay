import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { orgHasCapability } from "@/lib/page-guards"
import { orgDb } from "@/lib/org-db"
import { listStockAtLocation } from "@/lib/data/inventory"
import { listSuppliesForField } from "@/lib/data/supplies"
import { StationLogClient } from "@/components/inventory/station-log-client"

export const dynamic = "force-dynamic"

// Digital supply-station log (QR-scannable). Any staff member can record a few
// transactions in one submission; employee + station + time are automatic.
export default async function StationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")
  const orgId = session.organizationId
  if (!(await orgHasCapability(orgId, "supplies.inventory"))) redirect(session.role === "CLEANER" ? "/today" : "/dashboard")

  const { id } = await params
  const station = await orgDb(orgId).inventoryLocation.findFirst({ where: { id, isActive: true }, select: { id: true, name: true, kind: true } })
  if (!station) notFound()

  const [stock, supplies] = await Promise.all([listStockAtLocation(orgId, id), listSuppliesForField(orgId)])
  // Frequently-used = already stocked here; others available to add.
  const stockedIds = new Set(stock.map((s) => s.supply.id))
  const frequent = stock.map((s) => ({ id: s.supply.id, name: s.supply.name, unit: s.supply.unit, usageUnit: s.supply.usageUnit, onHand: Number(s.quantity).toString() }))
  const others = supplies.filter((s) => !stockedIds.has(s.id)).map((s) => ({ id: s.id, name: s.name, unit: s.unit, usageUnit: s.usageUnit ?? null, onHand: null }))

  return (
    <div className="mx-auto min-h-screen max-w-md bg-slate-50 px-4 py-6">
      <StationLogClient stationId={station.id} stationName={station.name} frequent={frequent} others={others} />
    </div>
  )
}

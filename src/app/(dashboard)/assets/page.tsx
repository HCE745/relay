import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { ASSET_TYPE, ASSET_STATUS, ASSET_STATUS_COLOR } from "@/lib/constants"
import { Plus, Package, ChevronRight, Download, Wrench, AlertTriangle, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { AssetDialog } from "@/components/assets/asset-dialog"
import { PlanGateContent } from "@/components/layout/plan-gate"
import { hasWashOrProfessional } from "@/lib/pricing"
import { CARWASH_ASSET_TAXONOMY } from "@/lib/car-wash-config"
import { PM_ASSET_TAXONOMY } from "@/lib/property-management-config"

export const dynamic = "force-dynamic"

export default async function AssetsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  const orgId = session.organizationId

  const [assets, locations, departments, vendors, org] = await Promise.all([
    prisma.asset.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      include: {
        location: { select: { name: true } },
        department: { select: { name: true } },
        vendor: { select: { name: true } },
        _count: { select: { issues: { where: { status: { notIn: ["RESOLVED", "CLOSED"] } } } } },
      },
    }),
    prisma.location.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { industry: true } }),
  ])

  const isCarWash = org?.industry === "Car Wash"
  const isPropMgmt = org?.industry === "Property Management"
  const pageTitle = (isCarWash || isPropMgmt) ? "Equipment" : "Assets"

  if (!hasWashOrProfessional(session.plan ?? "essentials", session.productLine)) {
    return (
      <div>
        <Header title={pageTitle} />
        <PlanGateContent feature="assets" />
      </div>
    )
  }

  const operational = assets.filter((a) => a.status === "OPERATIONAL").length
  const maintenance = assets.filter((a) => a.status === "MAINTENANCE").length
  const outOfService = assets.filter((a) => a.status === "OUT_OF_SERVICE").length

  return (
    <div>
      <Header
        title={pageTitle}
        actions={
          <>
            <a href="/api/export/assets" download className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </a>
            <AssetDialog locations={locations} departments={departments} vendors={vendors}>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                {(isCarWash || isPropMgmt) ? "Add Equipment" : "Add Asset"}
              </button>
            </AssetDialog>
          </>
        }
      />

      {/* Mobile page title */}
      <div className="md:hidden px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-gray-900">{pageTitle}</h1>
      </div>

      <div className="px-3 md:px-6 py-2 md:py-6 space-y-4 md:space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-emerald-500 shadow-sm p-3 md:p-4"
            style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.05) 0%, white 60%)" }}>
            <div className="text-2xl md:text-3xl font-black text-emerald-600">{operational}</div>
            <div className="text-xs md:text-sm font-medium text-gray-500 mt-0.5">Operational</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-amber-500 shadow-sm p-3 md:p-4"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.05) 0%, white 60%)" }}>
            <div className="text-2xl md:text-3xl font-black text-amber-600">{maintenance}</div>
            <div className="text-xs md:text-sm font-medium text-gray-500 mt-0.5">Maintenance</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-red-500 shadow-sm p-3 md:p-4"
            style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.05) 0%, white 60%)" }}>
            <div className="text-2xl md:text-3xl font-black text-red-600">{outOfService}</div>
            <div className="text-xs md:text-sm font-medium text-gray-500 mt-0.5">Out of Service</div>
          </div>
        </div>

        {/* ── Car Wash / Property Management Equipment Card Grid ──────── */}
        {(isCarWash || isPropMgmt) && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-tour="asset-list">
            {assets.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No equipment registered yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 divide-y sm:divide-y-0 gap-px bg-gray-100">
                {assets.map((asset) => {
                  const statusConfig = {
                    OPERATIONAL:    { label: "Operational",    bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
                    MAINTENANCE:    { label: "Maintenance",    bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500"   },
                    INACTIVE:       { label: "Inactive",       bg: "bg-gray-100",    text: "text-gray-600",    dot: "bg-gray-400"    },
                    OUT_OF_SERVICE: { label: "Out of Service", bg: "bg-red-100",     text: "text-red-700",     dot: "bg-red-500"     },
                  }[asset.status] ?? { label: asset.status, bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" }
                  const subtypeLabel = asset.assetSubtype
                    ? (
                        isPropMgmt
                          ? (PM_ASSET_TAXONOMY[asset.assetSubtype as keyof typeof PM_ASSET_TAXONOMY] ?? asset.assetSubtype)
                          : (CARWASH_ASSET_TAXONOMY[asset.assetSubtype as keyof typeof CARWASH_ASSET_TAXONOMY] ?? asset.assetSubtype)
                      )
                    : null
                  const openCount = asset._count.issues

                  return (
                    <Link
                      key={asset.id}
                      href={`/assets/${asset.id}`}
                      className="bg-white p-4 hover:bg-gray-50/80 transition-colors flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm leading-tight">{asset.name}</div>
                          {subtypeLabel && <div className="text-[11px] text-gray-400 mt-0.5">{subtypeLabel}</div>}
                        </div>
                        {openCount > 0 && (
                          <span className="shrink-0 flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            {openCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                          {statusConfig.label}
                        </span>
                        {asset.location && (
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{asset.location.name}
                          </span>
                        )}
                      </div>
                      {asset.model && (
                        <div className="text-[11px] text-gray-400 truncate">{asset.manufacturer} {asset.model}</div>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Generic Asset List ──────────────────────────────────────── */}
        {!isCarWash && !isPropMgmt && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-tour="asset-list">
          {assets.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No assets registered yet</p>
            </div>
          ) : (
            <>
              {/* ── Mobile card list ───────────────────────────────── */}
              <div className="md:hidden divide-y divide-gray-100">
                {assets.map((asset) => (
                  <Link
                    key={asset.id}
                    href={`/assets/${asset.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-sm text-gray-900 truncate">{asset.name}</p>
                        {asset._count.issues > 0 && (
                          <span className="text-xs text-red-600 font-semibold shrink-0">
                            {asset._count.issues} issue{asset._count.issues !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs ${ASSET_STATUS_COLOR[asset.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {ASSET_STATUS[asset.status as keyof typeof ASSET_STATUS] ?? asset.status}
                        </Badge>
                        {asset.location && (
                          <span className="text-xs text-gray-400">{asset.location.name}</span>
                        )}
                        {asset.assetTag && (
                          <span className="text-xs text-gray-400 font-mono">{asset.assetTag}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </Link>
                ))}
              </div>

              {/* ── Desktop table ──────────────────────────────────── */}
              <table className="hidden md:table w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Asset</th>
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Type</th>
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Location</th>
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Vendor</th>
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Open Issues</th>
                    <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">QR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <Link href={`/assets/${asset.id}`} className="group">
                          <div className="font-medium text-gray-900 group-hover:text-blue-600 text-sm">{asset.name}</div>
                          {asset.assetTag && <div className="text-xs text-gray-400 mt-0.5">Tag: {asset.assetTag}</div>}
                          {asset.model && <div className="text-xs text-gray-400">{asset.manufacturer} {asset.model}</div>}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {ASSET_TYPE[asset.type as keyof typeof ASSET_TYPE] ?? asset.type}
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={ASSET_STATUS_COLOR[asset.status] ?? "bg-gray-100 text-gray-700"}>
                          {ASSET_STATUS[asset.status as keyof typeof ASSET_STATUS] ?? asset.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{asset.location?.name ?? "—"}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{asset.vendor?.name ?? "—"}</td>
                      <td className="px-4 py-4">
                        {asset._count.issues > 0 ? (
                          <Link href={`/issues?assetId=${asset.id}`} className="text-sm text-red-600 font-medium hover:underline">
                            {asset._count.issues}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs font-mono text-gray-400 truncate max-w-20 block" title={asset.qrCode}>
                          {asset.qrCode.slice(0, 8)}…
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

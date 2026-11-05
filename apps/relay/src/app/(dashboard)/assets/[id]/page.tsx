import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"
import { Badge } from "@/components/ui/badge"
import { ASSET_TYPE, ASSET_STATUS, ASSET_STATUS_COLOR, STATUS_COLOR, ISSUE_STATUS, PRIORITY_COLOR, ISSUE_PRIORITY } from "@/lib/constants"
import Link from "next/link"
import { ArrowLeft, MapPin, Building2, Wrench, QrCode, AlertCircle } from "lucide-react"
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns"
import { AssetDialog } from "@/components/assets/asset-dialog"
import { RecentlyViewedTracker } from "@/components/layout/recently-viewed-tracker"

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")
  const { id } = await params
  const { from, to } = await searchParams

  const fromDate = from ? new Date(from) : null
  const toDate   = to   ? new Date(to)   : null
  // end-of-day for the to filter
  if (toDate) toDate.setHours(23, 59, 59, 999)

  const issueWhere: Record<string, unknown> = { assetId: id }
  if (fromDate || toDate) {
    issueWhere.createdAt = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate   ? { lte: toDate   } : {}),
    }
  }

  const asset = await prisma.asset.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      location: true,
      department: true,
      vendor: true,
      issues: {
        where:   issueWhere,
        orderBy: { createdAt: "desc" },
        include: {
          reportedBy: { select: { name: true } },
          assignedTo: { select: { name: true } },
        },
      },
      maintenanceLogs: {
        orderBy: { performedAt: "desc" },
        take: 20,
        include: { vendor: { select: { name: true } } },
      },
    },
  })

  if (!asset) notFound()

  const [locations, departments, vendors] = await Promise.all([
    prisma.location.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { organizationId: session.organizationId, isActive: true }, orderBy: { name: "asc" } }),
  ])

  return (
    <div>
      <RecentlyViewedTracker item={{
        id: asset.id,
        title: asset.name,
        type: "asset",
        status: asset.status,
        href: `/assets/${asset.id}`,
      }} />
      <Header
        title=""
        actions={
          <Link href="/assets" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
            Back to Assets
          </Link>
        }
      />

      <div className="p-6 max-w-5xl">
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge className={ASSET_STATUS_COLOR[asset.status] ?? "bg-gray-100 text-gray-700"}>
                  {ASSET_STATUS[asset.status as keyof typeof ASSET_STATUS] ?? asset.status}
                </Badge>
                <span className="text-xs text-gray-400">
                  {ASSET_TYPE[asset.type as keyof typeof ASSET_TYPE] ?? asset.type}
                </span>
                {asset.assetTag && <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{asset.assetTag}</span>}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{asset.name}</h2>
              {(asset.manufacturer || asset.model) && (
                <p className="text-gray-500 text-sm mt-1">{[asset.manufacturer, asset.model].filter(Boolean).join(" ")}</p>
              )}
            </div>
            <AssetDialog locations={locations} departments={departments} vendors={vendors} initialData={asset}>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Edit Asset</button>
            </AssetDialog>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
            {asset.serialNumber && (
              <div>
                <div className="text-xs text-gray-400">Serial Number</div>
                <div className="text-sm font-mono text-gray-700">{asset.serialNumber}</div>
              </div>
            )}
            {asset.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-400">Location</div>
                  <div className="text-sm text-gray-700">{asset.location.name}</div>
                </div>
              </div>
            )}
            {asset.department && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-400">Department</div>
                  <div className="text-sm text-gray-700">{asset.department.name}</div>
                </div>
              </div>
            )}
            {asset.vendor && (
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-400">Vendor</div>
                  <div className="text-sm text-gray-700">{asset.vendor.name}</div>
                </div>
              </div>
            )}
            {asset.purchaseDate && (
              <div>
                <div className="text-xs text-gray-400">Purchase Date</div>
                <div className="text-sm text-gray-700">{format(new Date(asset.purchaseDate), "MMM d, yyyy")}</div>
              </div>
            )}
            {asset.warrantyExpiry && (
              <div>
                <div className="text-xs text-gray-400">Warranty Expires</div>
                <div className="text-sm text-gray-700">{format(new Date(asset.warrantyExpiry), "MMM d, yyyy")}</div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-xs text-gray-400">QR Code</div>
                <div className="text-xs font-mono text-gray-500 truncate max-w-28">{asset.qrCode}</div>
              </div>
            </div>
          </div>

          {asset.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600">{asset.notes}</p>
            </div>
          )}
        </div>

        {/* Date-range filter for issue history */}
        <form method="GET" className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-sm text-gray-600 font-medium">Issue history:</span>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
          />
          <button type="submit" className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
            Filter
          </button>
          {(from || to) && (
            <Link href={`/assets/${asset.id}`} className="text-xs text-gray-400 hover:text-gray-600">
              Clear
            </Link>
          )}
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-tour="asset-history">
          {/* Issues */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-medium text-gray-900 text-sm">Issue History ({asset.issues.length})</h3>
              <div className="flex items-center gap-3">
                <Link href={`/issues?assetId=${asset.id}`} className="text-xs text-gray-400 hover:text-gray-600">
                  View in issues →
                </Link>
                <Link href={`/issues/new`} className="text-xs text-blue-600 hover:text-blue-700">Report Issue</Link>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {asset.issues.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No issues{(from || to) ? " in this date range" : ""}</p>
              ) : (
                asset.issues.map((issue) => {
                  const resolutionMinutes = issue.resolvedAt
                    ? differenceInMinutes(new Date(issue.resolvedAt), new Date(issue.createdAt))
                    : null
                  const resolutionLabel = resolutionMinutes != null
                    ? resolutionMinutes < 60
                      ? `${resolutionMinutes}m`
                      : resolutionMinutes < 1440
                      ? `${Math.round(resolutionMinutes / 60)}h`
                      : `${Math.round(resolutionMinutes / 1440)}d`
                    : null
                  return (
                    <Link key={issue.id} href={`/issues/${issue.id}`} className="block px-5 py-3 hover:bg-gray-50">
                      <div className="flex items-start gap-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 truncate">{issue.title}</div>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {format(new Date(issue.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6 mb-1">
                        <Badge className={`text-xs ${PRIORITY_COLOR[issue.priority]}`}>
                          {ISSUE_PRIORITY[issue.priority as keyof typeof ISSUE_PRIORITY] ?? issue.priority}
                        </Badge>
                        <Badge className={`text-xs ${STATUS_COLOR[issue.status]}`}>
                          {ISSUE_STATUS[issue.status as keyof typeof ISSUE_STATUS] ?? issue.status}
                        </Badge>
                        {resolutionLabel && (
                          <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                            Resolved in {resolutionLabel}
                          </span>
                        )}
                        {issue.resolutionCost != null && (
                          <span className="text-xs text-gray-500">${issue.resolutionCost.toFixed(2)}</span>
                        )}
                      </div>
                      {issue.rootCause && (
                        <p className="text-xs text-gray-500 pl-6 truncate">
                          <span className="font-medium">Root cause:</span> {issue.rootCause}
                        </p>
                      )}
                      {issue.resolutionCategory && (
                        <p className="text-xs text-gray-500 pl-6">
                          <span className="font-medium">Action:</span> {issue.resolutionCategory}
                        </p>
                      )}
                      {issue.assignedTo && (
                        <p className="text-xs text-gray-400 pl-6">Handled by {issue.assignedTo.name}</p>
                      )}
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          {/* Maintenance Log */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-medium text-gray-900 text-sm">Maintenance Log ({asset.maintenanceLogs.length})</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {asset.maintenanceLogs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No maintenance records</p>
              ) : (
                asset.maintenanceLogs.map((log) => (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 capitalize">{log.type}</span>
                      <span className="text-xs text-gray-400">{format(new Date(log.performedAt), "MMM d, yyyy")}</span>
                    </div>
                    {log.description && <p className="text-xs text-gray-500 mt-0.5">{log.description}</p>}
                    <div className="flex items-center gap-3 mt-0.5">
                      {log.vendor && <span className="text-xs text-gray-400">By {log.vendor.name}</span>}
                      {log.cost && <span className="text-xs text-gray-400">${log.cost.toFixed(2)}</span>}
                      {log.nextDueAt && <span className="text-xs text-blue-500">Next: {format(new Date(log.nextDueAt), "MMM d, yyyy")}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

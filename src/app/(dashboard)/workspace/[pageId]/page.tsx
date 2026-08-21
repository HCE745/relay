import { redirect } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getAccessConfig, type PageAccessConfig } from "@/lib/page-access"
import { fetchIssues, fetchKpiCount } from "@/lib/issue-queries"
import { resolveViewIcon } from "@/lib/custom-view-config"
import { cn } from "@/lib/utils"
import {
  type PageWidget,
  type WidgetConfig,
  type KpiCountConfig,
  type IssuesListConfig,
  type CustomViewRefConfig,
  type AssetsListConfig,
  type LocationsListConfig,
  type TextConfig,
  type LinkBlockConfig,
  widthColSpan,
  KPI_METRICS,
  WIDGET_META,
} from "@/lib/widget-registry"
import type { IssueColumnKey, ViewFilters } from "@/lib/custom-view-config"
import { VIEW_SORT_OPTIONS } from "@/lib/custom-view-config"
import {
  AlertCircle,
  ExternalLink,
  MapPin,
  Package,
  LayoutDashboard,
} from "lucide-react"

export const dynamic = "force-dynamic"

// ── Widget data types ─────────────────────────────────────────────────────────

type IssueRow = Awaited<ReturnType<typeof fetchIssues>>[number]
type AssetRow = { id: string; name: string; type: string; status: string; location: { name: string } | null }
type LocationRow = { id: string; name: string; locationType: string | null }

type WidgetData =
  | { kind: "kpi";       value: number; label: string; metric: string }
  | { kind: "issues";    issues: IssueRow[]; title?: string; columns: IssueColumnKey[] | null }
  | { kind: "assets";    assets: AssetRow[]; title?: string }
  | { kind: "locations"; locations: LocationRow[]; title?: string }
  | { kind: "text";      title?: string; body: string }
  | { kind: "link";      title: string; url: string; description?: string }
  | { kind: "denied" }
  | { kind: "error" }

// ── Per-widget data fetch ─────────────────────────────────────────────────────

async function fetchWidgetData(
  widget: PageWidget,
  orgId: string,
  allowedSet: Set<string>,
): Promise<WidgetData> {
  try {
    const config = widget.config as WidgetConfig & Record<string, unknown>

    switch (widget.type) {
      case "kpi-count": {
        if (!allowedSet.has("dashboard")) return { kind: "denied" }
        const c = config as KpiCountConfig
        const value = await fetchKpiCount(orgId, c.metric)
        return { kind: "kpi", value, label: c.title ?? KPI_METRICS[c.metric], metric: c.metric }
      }

      case "issues-list": {
        if (!allowedSet.has("issues")) return { kind: "denied" }
        const c = config as IssuesListConfig
        const filters: ViewFilters = c.filters ?? {}
        const sortDef = c.sort ? VIEW_SORT_OPTIONS.find(o => o.value === c.sort) : null
        const issues = await fetchIssues(orgId, filters, sortDef?.field, sortDef?.dir, c.maxRows ?? 10)
        return {
          kind:    "issues",
          issues,
          title:   c.title,
          columns: c.columns ?? null,
        }
      }

      case "custom-view": {
        if (!allowedSet.has("issues")) return { kind: "denied" }
        const c = config as CustomViewRefConfig
        const view = await prisma.customView.findUnique({ where: { id: c.viewId } })
        if (!view || view.organizationId !== orgId) return { kind: "error" }
        const filters = (view.filters ?? {}) as ViewFilters
        const issues  = await fetchIssues(orgId, filters, view.sortField, view.sortDir, 10)
        return {
          kind:    "issues",
          issues,
          title:   c.title ?? view.name,
          columns: Array.isArray(view.columns) ? (view.columns as IssueColumnKey[]) : null,
        }
      }

      case "assets-list": {
        if (!allowedSet.has("assets")) return { kind: "denied" }
        const c = config as AssetsListConfig
        const assets = await prisma.asset.findMany({
          where:   { organizationId: orgId },
          take:    c.maxRows ?? 10,
          orderBy: { name: "asc" },
          select:  { id: true, name: true, type: true, status: true, location: { select: { name: true } } },
        })
        return { kind: "assets", assets, title: c.title }
      }

      case "locations-list": {
        if (!allowedSet.has("locations")) return { kind: "denied" }
        const c = config as LocationsListConfig
        const locations = await prisma.location.findMany({
          where:   { organizationId: orgId, isActive: true },
          take:    c.maxRows ?? 10,
          orderBy: { name: "asc" },
          select:  { id: true, name: true, locationType: true },
        })
        return { kind: "locations", locations, title: c.title }
      }

      case "text": {
        const c = config as TextConfig
        return { kind: "text", title: c.title, body: c.body }
      }

      case "link-block": {
        const c = config as LinkBlockConfig
        return { kind: "link", title: c.title, url: c.url, description: c.description }
      }

      default:
        return { kind: "error" }
    }
  } catch {
    return { kind: "error" }
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  RESOLVED:    "bg-green-100 text-green-700",
  CLOSED:      "bg-gray-100 text-gray-600",
  ESCALATED:   "bg-red-100 text-red-700",
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "text-red-600 font-semibold",
  HIGH:     "text-orange-600",
  MEDIUM:   "text-yellow-600",
  LOW:      "text-gray-400",
}

// ── Widget renderer ───────────────────────────────────────────────────────────

function WidgetCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-full flex flex-col">
      {title && (
        <div className="px-4 pt-4 pb-2 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        </div>
      )}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}

function KpiWidget({ data }: { data: Extract<WidgetData, { kind: "kpi" }> }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1 h-full justify-center">
      <p className="text-4xl font-bold text-gray-900">{data.value.toLocaleString()}</p>
      <p className="text-sm text-gray-500">{data.label}</p>
    </div>
  )
}

function IssuesWidget({ data }: { data: Extract<WidgetData, { kind: "issues" }> }) {
  const col = (key: IssueColumnKey) => !data.columns || data.columns.includes(key)

  return (
    <WidgetCard title={data.title}>
      {data.issues.length === 0 ? (
        <p className="text-sm text-gray-400 px-4 py-6 text-center">No issues found</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {data.issues.map(issue => (
            <Link
              key={issue.id}
              href={`/issues/${issue.id}`}
              className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{issue.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {col("priority") && (
                    <span className={cn("text-xs", PRIORITY_COLORS[issue.priority] ?? "text-gray-500")}>
                      {issue.priority}
                    </span>
                  )}
                  {col("status") && (
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", STATUS_COLORS[issue.status] ?? "bg-gray-100 text-gray-600")}>
                      {issue.status.replace("_", " ")}
                    </span>
                  )}
                  {col("location") && issue.location && (
                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {issue.location.name}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}

function AssetsWidget({ data }: { data: Extract<WidgetData, { kind: "assets" }> }) {
  const STATUS_DOT: Record<string, string> = {
    OPERATIONAL: "bg-green-500",
    MAINTENANCE: "bg-yellow-500",
    INACTIVE:    "bg-gray-400",
    RETIRED:     "bg-red-400",
  }
  return (
    <WidgetCard title={data.title ?? "Assets"}>
      {data.assets.length === 0 ? (
        <p className="text-sm text-gray-400 px-4 py-6 text-center">No assets found</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {data.assets.map(asset => (
            <Link
              key={asset.id}
              href={`/assets/${asset.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_DOT[asset.status] ?? "bg-gray-300")} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
                {asset.location && (
                  <p className="text-xs text-gray-400 truncate">{asset.location.name}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{asset.type}</span>
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}

function LocationsWidget({ data }: { data: Extract<WidgetData, { kind: "locations" }> }) {
  return (
    <WidgetCard title={data.title ?? "Locations"}>
      {data.locations.length === 0 ? (
        <p className="text-sm text-gray-400 px-4 py-6 text-center">No locations found</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {data.locations.map(loc => (
            <Link
              key={loc.id}
              href={`/locations/${loc.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{loc.name}</p>
                {loc.locationType && (
                  <p className="text-xs text-gray-400">{loc.locationType}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}

function TextWidget({ data }: { data: Extract<WidgetData, { kind: "text" }> }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full">
      {data.title && <h3 className="text-sm font-semibold text-gray-700 mb-2">{data.title}</h3>}
      <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.body}</p>
    </div>
  )
}

function LinkWidget({ data }: { data: Extract<WidgetData, { kind: "link" }> }) {
  const isExternal = data.url.startsWith("https://")
  return (
    <Link
      href={data.url}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-3 hover:border-blue-300 hover:shadow-sm transition-all h-full"
    >
      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <ExternalLink className="w-4 h-4 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{data.title}</p>
        {data.description && <p className="text-xs text-gray-500 mt-0.5">{data.description}</p>}
        <p className="text-xs text-blue-500 truncate mt-1">{data.url}</p>
      </div>
    </Link>
  )
}

function DeniedWidget({ widgetType }: { widgetType: string }) {
  const meta = WIDGET_META.find(m => m.type === widgetType)
  return (
    <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-5 flex items-center justify-center h-full min-h-[80px]">
      <p className="text-xs text-gray-400">{meta?.name ?? widgetType} — not available</p>
    </div>
  )
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ pageId: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { pageId } = await params

  const [page, org] = await Promise.all([
    prisma.customPage.findFirst({
      where: { id: pageId, organizationId: session.organizationId },
    }),
    prisma.organization.findUnique({
      where:  { id: session.organizationId },
      select: { pageAccessConfig: true },
    }),
  ])

  if (!page) redirect("/dashboard")

  const allowedPageKeys = getAccessConfig(
    session.role,
    (org?.pageAccessConfig ?? null) as PageAccessConfig | null,
  )
  const allowedSet = new Set(allowedPageKeys)

  const rawWidgets = Array.isArray(page.widgets) ? (page.widgets as unknown[]) : []
  const widgets = rawWidgets as PageWidget[]
  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order)

  const widgetDataResults = await Promise.all(
    sortedWidgets.map(w => fetchWidgetData(w, session.organizationId, allowedSet)),
  )

  const PageIcon = page.icon ? resolveViewIcon(page.icon) : LayoutDashboard

  return (
    <div>
      <Header title={page.name} />

      <div className="px-3 md:px-6 py-4 md:py-6">
        {/* Page header */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <PageIcon className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{page.name}</h1>
            {page.description && (
              <p className="text-sm text-gray-500">{page.description}</p>
            )}
          </div>
        </div>

        {/* Widget grid */}
        {sortedWidgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">This page has no widgets yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              An admin can add widgets in{" "}
              <Link href="/settings/workspace/pages" className="text-blue-500 hover:underline">
                Settings → Workspace → Pages
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {sortedWidgets.map((widget, i) => {
              const data = widgetDataResults[i]
              const spanClass = widthColSpan(widget.width)

              return (
                <div key={widget.id} className={cn(spanClass, "min-w-0")}>
                  {data.kind === "denied" ? (
                    <DeniedWidget widgetType={widget.type} />
                  ) : data.kind === "error" ? (
                    <div className="bg-red-50 rounded-xl border border-red-100 p-4 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-600">Widget could not be loaded</p>
                    </div>
                  ) : data.kind === "kpi" ? (
                    <KpiWidget data={data} />
                  ) : data.kind === "issues" ? (
                    <IssuesWidget data={data} />
                  ) : data.kind === "assets" ? (
                    <AssetsWidget data={data} />
                  ) : data.kind === "locations" ? (
                    <LocationsWidget data={data} />
                  ) : data.kind === "text" ? (
                    <TextWidget data={data} />
                  ) : data.kind === "link" ? (
                    <LinkWidget data={data} />
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Widget types, metadata, and config validation for custom page builder.
// This file is safe to import from both client and server components.

import type { ViewFilters, IssueColumnKey, ViewSortValue } from "@/lib/custom-view-config"
import { ISSUE_COLUMN_KEYS, VIEW_SORT_OPTIONS } from "@/lib/custom-view-config"

// ── Widget types ──────────────────────────────────────────────────────────────

export const WIDGET_TYPES = [
  "kpi-count",
  "issues-list",
  "custom-view",
  "assets-list",
  "locations-list",
  "text",
  "link-block",
] as const

export type WidgetTypeKey = (typeof WIDGET_TYPES)[number]

export type WidgetWidth = "third" | "half" | "two-thirds" | "full"

export const WIDGET_WIDTHS: WidgetWidth[] = ["third", "half", "two-thirds", "full"]

// ── KPI metrics ───────────────────────────────────────────────────────────────

export const KPI_METRICS = {
  open_issues:             "Open Issues",
  escalated_issues:        "Escalated Issues",
  critical_issues:         "Critical Issues",
  unassigned_issues:       "Unassigned Issues",
  resolved_today:          "Resolved Today",
  new_today:               "New Today",
  total_assets:            "Total Assets",
  open_equipment_issues:   "Open Equipment Issues",
  open_maintenance_issues: "Open Maintenance Issues",
  open_safety_issues:      "Open Safety Issues",
} as const

export type KpiMetricKey = keyof typeof KPI_METRICS

export const KPI_METRIC_KEYS = Object.keys(KPI_METRICS) as KpiMetricKey[]

// ── Per-widget config interfaces ──────────────────────────────────────────────

export interface KpiCountConfig    { metric: KpiMetricKey; title?: string }
export interface IssuesListConfig  { title?: string; filters?: ViewFilters; sort?: ViewSortValue; maxRows?: number; columns?: IssueColumnKey[] }
export interface CustomViewRefConfig { viewId: string; title?: string }
export interface AssetsListConfig  { title?: string; maxRows?: number }
export interface LocationsListConfig { title?: string; maxRows?: number }
export interface TextConfig        { title?: string; body: string }
export interface LinkBlockConfig   { title: string; url: string; description?: string }

export type WidgetConfig =
  | ({ type: "kpi-count"      } & KpiCountConfig)
  | ({ type: "issues-list"    } & IssuesListConfig)
  | ({ type: "custom-view"    } & CustomViewRefConfig)
  | ({ type: "assets-list"    } & AssetsListConfig)
  | ({ type: "locations-list" } & LocationsListConfig)
  | ({ type: "text"           } & TextConfig)
  | ({ type: "link-block"     } & LinkBlockConfig)

// ── PageWidget (stored in CustomPage.widgets JSON) ────────────────────────────

export interface PageWidget {
  id:     string
  type:   WidgetTypeKey
  config: WidgetConfig
  width:  WidgetWidth
  order:  number
}

// ── CustomPage row shape for client components ────────────────────────────────

export interface CustomPageRow {
  id:           string
  name:         string
  icon:         string | null
  description:  string | null
  widgets:      PageWidget[]
  showInSidebar: boolean
  sidebarOrder: number
  createdAt:    string
}

// ── Sidebar item shape (same as CustomViewSidebarItem) ────────────────────────

export interface CustomPageSidebarItem {
  id:   string
  name: string
  icon: string | null
}

// ── Widget metadata for the UI builder ───────────────────────────────────────

export interface WidgetMeta {
  type:         WidgetTypeKey
  name:         string
  description:  string
  defaultWidth: WidgetWidth
  requiredKey?: string
}

export const WIDGET_META: WidgetMeta[] = [
  { type: "kpi-count",      name: "KPI Counter",        description: "Single metric shown as a large number",    defaultWidth: "third"     },
  { type: "issues-list",    name: "Issues List",         description: "Filtered list of issues",                  defaultWidth: "half",      requiredKey: "issues"    },
  { type: "custom-view",    name: "Saved View",          description: "Embed an existing saved issue view",       defaultWidth: "full",      requiredKey: "issues"    },
  { type: "assets-list",    name: "Assets / Equipment",  description: "List of assets",                           defaultWidth: "half",      requiredKey: "assets"    },
  { type: "locations-list", name: "Locations / Sites",   description: "List of locations",                        defaultWidth: "half",      requiredKey: "locations" },
  { type: "text",           name: "Text Block",          description: "Plain text section with optional heading", defaultWidth: "full"      },
  { type: "link-block",     name: "Link",                description: "A clickable link card",                    defaultWidth: "third"     },
]

// ── Server-side widget config validation ──────────────────────────────────────
// Returns a validated PageWidget or { error: string }

type ParseResult<T> = T | { error: string }

function parseWidgetConfig(type: WidgetTypeKey, raw: unknown): ParseResult<WidgetConfig> {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>

  switch (type) {
    case "kpi-count": {
      const metric = typeof c.metric === "string" && (KPI_METRIC_KEYS as string[]).includes(c.metric)
        ? (c.metric as KpiMetricKey) : null
      if (!metric) return { error: "kpi-count: valid metric required" }
      const title = typeof c.title === "string" ? c.title.trim().slice(0, 80) : undefined
      return { type, metric, ...(title ? { title } : {}) }
    }

    case "issues-list": {
      const rawF = (c.filters && typeof c.filters === "object" ? c.filters : {}) as Record<string, unknown>
      const filters: ViewFilters = {}
      if (typeof rawF.status     === "string") filters.status     = rawF.status
      if (typeof rawF.priority   === "string") filters.priority   = rawF.priority
      if (typeof rawF.category   === "string") filters.category   = rawF.category
      if (typeof rawF.search     === "string") filters.search     = rawF.search.slice(0, 200)
      if (typeof rawF.locationId === "string") filters.locationId = rawF.locationId
      if (rawF.isEscalated === true)           filters.isEscalated = true

      const sort = typeof c.sort === "string" && VIEW_SORT_OPTIONS.some(o => o.value === c.sort)
        ? (c.sort as ViewSortValue) : undefined
      const maxRows = typeof c.maxRows === "number"
        ? Math.min(20, Math.max(1, Math.round(c.maxRows))) : 10
      const rawCols = Array.isArray(c.columns) ? (c.columns as string[]) : null
      const columns = rawCols
        ? rawCols.filter((col): col is IssueColumnKey => (ISSUE_COLUMN_KEYS as readonly string[]).includes(col))
        : undefined
      const title = typeof c.title === "string" ? c.title.trim().slice(0, 80) : undefined

      return {
        type,
        ...(title   ? { title }   : {}),
        filters,
        ...(sort    ? { sort }    : {}),
        maxRows,
        ...(columns ? { columns } : {}),
      }
    }

    case "custom-view": {
      const viewId = typeof c.viewId === "string" && c.viewId.length > 0 ? c.viewId : null
      if (!viewId) return { error: "custom-view: viewId required" }
      const title = typeof c.title === "string" ? c.title.trim().slice(0, 80) : undefined
      return { type, viewId, ...(title ? { title } : {}) }
    }

    case "assets-list": {
      const maxRows = typeof c.maxRows === "number"
        ? Math.min(20, Math.max(1, Math.round(c.maxRows))) : 10
      const title = typeof c.title === "string" ? c.title.trim().slice(0, 80) : undefined
      return { type, ...(title ? { title } : {}), maxRows }
    }

    case "locations-list": {
      const maxRows = typeof c.maxRows === "number"
        ? Math.min(20, Math.max(1, Math.round(c.maxRows))) : 10
      const title = typeof c.title === "string" ? c.title.trim().slice(0, 80) : undefined
      return { type, ...(title ? { title } : {}), maxRows }
    }

    case "text": {
      const body = typeof c.body === "string" ? c.body.slice(0, 2000) : ""
      const title = typeof c.title === "string" ? c.title.trim().slice(0, 80) : undefined
      return { type, ...(title ? { title } : {}), body }
    }

    case "link-block": {
      const title = typeof c.title === "string" ? c.title.trim().slice(0, 80) : ""
      if (!title) return { error: "link-block: title required" }
      const rawUrl = typeof c.url === "string" ? c.url.trim() : ""
      if (!rawUrl) return { error: "link-block: url required" }
      if (!rawUrl.startsWith("https://") && !rawUrl.startsWith("/")) {
        return { error: "link-block: url must start with https:// or /" }
      }
      if (rawUrl.startsWith("https://")) {
        try { new URL(rawUrl) } catch { return { error: "link-block: invalid URL" } }
      }
      const description = typeof c.description === "string"
        ? c.description.trim().slice(0, 200) : undefined
      return { type, title, url: rawUrl, ...(description ? { description } : {}) }
    }

    default:
      return { error: `Unknown widget type` }
  }
}

export function parseWidget(raw: unknown): ParseResult<PageWidget> {
  if (!raw || typeof raw !== "object") return { error: "Invalid widget" }
  const w = raw as Record<string, unknown>

  const id = typeof w.id === "string" && w.id.length > 0 ? w.id : null
  if (!id) return { error: "Widget id required" }

  const type = typeof w.type === "string" && (WIDGET_TYPES as readonly string[]).includes(w.type)
    ? (w.type as WidgetTypeKey) : null
  if (!type) return { error: `Unknown widget type: ${String(w.type)}` }

  const width: WidgetWidth = typeof w.width === "string" && (WIDGET_WIDTHS as string[]).includes(w.width)
    ? (w.width as WidgetWidth) : "half"
  const order = typeof w.order === "number" ? Math.round(w.order) : 0

  const configResult = parseWidgetConfig(type, w.config)
  if ("error" in configResult) return configResult

  return { id, type, config: configResult, width, order }
}

export function parseWidgets(rawWidgets: unknown[]): ParseResult<PageWidget[]> {
  if (rawWidgets.length > 16) return { error: "Maximum 16 widgets per page" }
  const widgets: PageWidget[] = []
  for (const raw of rawWidgets) {
    const result = parseWidget(raw)
    if ("error" in result) return result
    widgets.push(result)
  }
  return widgets
}

// ── Width → CSS class ─────────────────────────────────────────────────────────

export function widthColSpan(width: WidgetWidth): string {
  switch (width) {
    case "third":      return "col-span-12 md:col-span-4"
    case "half":       return "col-span-12 md:col-span-6"
    case "two-thirds": return "col-span-12 md:col-span-8"
    case "full":       return "col-span-12"
  }
}

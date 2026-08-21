import type { ElementType } from "react"
import {
  AlertCircle, AlertTriangle, Wrench, HardHat, Package, MapPin,
  Flame, Zap, Shield, Flag, Layers, Filter,
  ClipboardList, CheckSquare, Clock, Building2,
} from "lucide-react"

// ── Approved icon set ─────────────────────────────────────────────────────────

export const CUSTOM_VIEW_ICON_MAP: Record<string, ElementType> = {
  AlertCircle, AlertTriangle, Wrench, HardHat, Package, MapPin,
  Flame, Zap, Shield, Flag, Layers, Filter,
  ClipboardList, CheckSquare, Clock, Building2,
}

export const CUSTOM_VIEW_ICON_NAMES = Object.keys(CUSTOM_VIEW_ICON_MAP) as string[]

export function resolveViewIcon(name: string | null | undefined): ElementType {
  return (name && CUSTOM_VIEW_ICON_MAP[name]) ? CUSTOM_VIEW_ICON_MAP[name] : AlertCircle
}

// ── Column keys ───────────────────────────────────────────────────────────────

export const ISSUE_COLUMN_KEYS = [
  "priority", "status", "category", "assignedTo", "location", "createdAt",
] as const

export type IssueColumnKey = (typeof ISSUE_COLUMN_KEYS)[number]

export const ISSUE_COLUMN_LABELS: Record<IssueColumnKey, string> = {
  priority:   "Priority",
  status:     "Status",
  category:   "Category",
  assignedTo: "Assigned To",
  location:   "Location",
  createdAt:  "Created",
}

// ── Sort options ──────────────────────────────────────────────────────────────

export const VIEW_SORT_OPTIONS = [
  { value: "priority_desc",  label: "Priority (highest first)", field: "priority",  dir: "desc" },
  { value: "createdAt_desc", label: "Newest first",              field: "createdAt", dir: "desc" },
  { value: "createdAt_asc",  label: "Oldest first",              field: "createdAt", dir: "asc"  },
  { value: "updatedAt_desc", label: "Recently updated",          field: "updatedAt", dir: "desc" },
] as const

export type ViewSortValue = (typeof VIEW_SORT_OPTIONS)[number]["value"]

export function resolveSortOrder(
  field: string | null | undefined,
  dir: string | null | undefined
): { field: string; dir: string; value: ViewSortValue } {
  if (field && dir) {
    const candidate = `${field}_${dir}` as ViewSortValue
    if (VIEW_SORT_OPTIONS.some(o => o.value === candidate)) {
      return { field, dir, value: candidate }
    }
  }
  return { field: "priority", dir: "desc", value: "priority_desc" }
}

// ── Filters type ──────────────────────────────────────────────────────────────

export interface ViewFilters {
  status?:      string
  priority?:    string
  category?:    string
  search?:      string
  locationId?:  string
  isEscalated?: boolean
}

// ── Sidebar item shape passed from layout → sidebar ───────────────────────────

export interface CustomViewSidebarItem {
  id:   string
  name: string
  icon: string | null
}

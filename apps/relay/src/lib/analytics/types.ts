// Client-safe types — no server imports

export type VisualType = "KPI_CARD" | "BAR_CHART" | "LEADERBOARD" | "TREND_LINE" | "DATA_TABLE"

export type MetricResult =
  | { type: "scalar"; value: number; unit?: string; change?: number | null }
  | { type: "series"; data: Array<{ label: string; value: number }> }
  | { type: "ranked"; items: Array<{ rank: number; label: string; value: number; sublabel?: string }> }
  | { type: "table"; columns: Array<{ key: string; label: string }>; rows: Array<Record<string, string | number>> }

export interface WidgetConfig {
  id: string
  metricKey: string
  visualType: VisualType
  title?: string
  filters?: Record<string, string>
  width?: 1 | 2 | 3
  position?: number
}

export interface MetricCatalogEntry {
  key: string
  label: string
  description: string
  defaultVisualType: VisualType
  supportedVisualTypes: VisualType[]
}

export const METRICS_CATALOG: MetricCatalogEntry[] = [
  { key: "issues.count",              label: "Total Issues",           description: "Number of issues created in the period",              defaultVisualType: "KPI_CARD",  supportedVisualTypes: ["KPI_CARD", "BAR_CHART", "TREND_LINE", "DATA_TABLE"] },
  { key: "issues.resolved",           label: "Resolved Issues",        description: "Issues resolved in the period",                       defaultVisualType: "KPI_CARD",  supportedVisualTypes: ["KPI_CARD", "TREND_LINE"] },
  { key: "issues.open",               label: "Open Issues",            description: "Currently open or in-progress issues",                defaultVisualType: "KPI_CARD",  supportedVisualTypes: ["KPI_CARD", "BAR_CHART"] },
  { key: "issues.overdue",            label: "Overdue Issues",         description: "Open issues past their due date",                     defaultVisualType: "KPI_CARD",  supportedVisualTypes: ["KPI_CARD", "LEADERBOARD"] },
  { key: "issues.resolution_rate",    label: "Resolution Rate",        description: "Percentage of issues resolved in the period",         defaultVisualType: "KPI_CARD",  supportedVisualTypes: ["KPI_CARD"] },
  { key: "issues.avg_resolution_time",label: "Avg Resolution Time",    description: "Average days from created to resolved",               defaultVisualType: "KPI_CARD",  supportedVisualTypes: ["KPI_CARD"] },
  { key: "suggestions.count",         label: "Suggestions",            description: "Total suggestions submitted in the period",           defaultVisualType: "KPI_CARD",  supportedVisualTypes: ["KPI_CARD", "BAR_CHART", "TREND_LINE"] },
  { key: "suggestions.implemented",   label: "Implemented Suggestions",description: "Suggestions marked as implemented in the period",     defaultVisualType: "KPI_CARD",  supportedVisualTypes: ["KPI_CARD"] },
  { key: "assignments.completed",     label: "Completed Assignments",  description: "Assignments completed in the period",                 defaultVisualType: "KPI_CARD",  supportedVisualTypes: ["KPI_CARD", "TREND_LINE"] },
  { key: "assignments.overdue",       label: "Overdue Assignments",    description: "Assignments past their due date and not completed",   defaultVisualType: "KPI_CARD",  supportedVisualTypes: ["KPI_CARD"] },
  { key: "qr.submissions",            label: "QR Submissions",         description: "QR code form submissions in the period",              defaultVisualType: "KPI_CARD",  supportedVisualTypes: ["KPI_CARD", "TREND_LINE"] },
]

export const DASHBOARD_TEMPLATES: Array<{ name: string; widgets: WidgetConfig[] }> = [
  {
    name: "Operations Overview",
    widgets: [
      { id: "t1-w1", metricKey: "issues.count",              visualType: "KPI_CARD",  title: "Total Issues",          width: 1, position: 0 },
      { id: "t1-w2", metricKey: "issues.open",               visualType: "KPI_CARD",  title: "Open Issues",           width: 1, position: 1 },
      { id: "t1-w3", metricKey: "issues.resolution_rate",    visualType: "KPI_CARD",  title: "Resolution Rate",       width: 1, position: 2 },
      { id: "t1-w4", metricKey: "issues.avg_resolution_time",visualType: "KPI_CARD",  title: "Avg Resolution Time",   width: 1, position: 3 },
      { id: "t1-w5", metricKey: "assignments.overdue",       visualType: "KPI_CARD",  title: "Overdue Assignments",   width: 1, position: 4 },
      { id: "t1-w6", metricKey: "issues.count",              visualType: "BAR_CHART", title: "Issues by Status",      width: 2, position: 5 },
    ],
  },
  {
    name: "Team Activity",
    widgets: [
      { id: "t2-w1", metricKey: "assignments.completed",     visualType: "KPI_CARD",  title: "Assignments Completed", width: 1, position: 0 },
      { id: "t2-w2", metricKey: "assignments.overdue",       visualType: "KPI_CARD",  title: "Overdue Assignments",   width: 1, position: 1 },
      { id: "t2-w3", metricKey: "suggestions.count",         visualType: "KPI_CARD",  title: "Suggestions",           width: 1, position: 2 },
      { id: "t2-w4", metricKey: "suggestions.implemented",   visualType: "KPI_CARD",  title: "Implemented",           width: 1, position: 3 },
      { id: "t2-w5", metricKey: "assignments.completed",     visualType: "TREND_LINE",title: "Completion Trend",      width: 3, position: 4 },
    ],
  },
  {
    name: "Safety & Quality",
    widgets: [
      { id: "t3-w1", metricKey: "issues.overdue",            visualType: "KPI_CARD",   title: "Overdue Issues",       width: 1, position: 0 },
      { id: "t3-w2", metricKey: "qr.submissions",            visualType: "KPI_CARD",   title: "QR Submissions",       width: 1, position: 1 },
      { id: "t3-w3", metricKey: "issues.resolution_rate",    visualType: "KPI_CARD",   title: "Resolution Rate",      width: 1, position: 2 },
      { id: "t3-w4", metricKey: "issues.overdue",            visualType: "LEADERBOARD",title: "Overdue by Category",  width: 2, position: 3 },
      { id: "t3-w5", metricKey: "suggestions.count",         visualType: "BAR_CHART",  title: "Suggestions by Status",width: 2, position: 4 },
    ],
  },
]

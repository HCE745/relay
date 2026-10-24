// Client-safe types — no server imports

export type VisualType = "KPI_CARD" | "BAR_CHART" | "LEADERBOARD" | "TREND_LINE" | "DATA_TABLE" | "BENCHMARK"

export type MetricResult =
  | { type: "scalar"; value: number; unit?: string; change?: number | null }
  | { type: "series"; data: Array<{ label: string; value: number }> }
  | { type: "ranked"; items: Array<{ rank: number; label: string; value: number; sublabel?: string }> }
  | { type: "table"; columns: Array<{ key: string; label: string }>; rows: Array<Record<string, string | number>> }
  | { type: "benchmark"; locations: Array<{ label: string; value: number }>; orgAverage: number; unit?: string }

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
  section?: string
}

export const METRICS_CATALOG: MetricCatalogEntry[] = [
  { key: "issues.count",              label: "Total Issues",            description: "Number of issues created in the period",              defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD", "BAR_CHART", "TREND_LINE", "DATA_TABLE"] },
  { key: "issues.resolved",           label: "Resolved Issues",         description: "Issues resolved in the period",                       defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD", "TREND_LINE"] },
  { key: "issues.open",               label: "Open Issues",             description: "Currently open or in-progress issues",                defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD", "BAR_CHART"] },
  { key: "issues.overdue",            label: "Overdue Issues",          description: "Open issues past their due date",                     defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD", "LEADERBOARD"] },
  { key: "issues.resolution_rate",    label: "Resolution Rate",         description: "Percentage of issues resolved in the period",         defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD"] },
  { key: "issues.avg_resolution_time",label: "Avg Resolution Time",     description: "Average days from created to resolved",               defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD"] },
  { key: "suggestions.count",         label: "Suggestions",             description: "Total suggestions submitted in the period",           defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD", "BAR_CHART", "TREND_LINE"] },
  { key: "suggestions.implemented",   label: "Implemented Suggestions", description: "Suggestions marked as implemented in the period",     defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD"] },
  { key: "assignments.completed",     label: "Completed Assignments",   description: "Assignments completed in the period",                 defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD", "TREND_LINE"] },
  { key: "assignments.overdue",       label: "Overdue Assignments",     description: "Assignments past their due date and not completed",   defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD"] },
  { key: "qr.submissions",            label: "QR Submissions",          description: "QR code form submissions in the period",              defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD", "TREND_LINE"] },
  { key: "issues.safety",             label: "Safety Issues",           description: "Issues categorized as safety-related in the period",  defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD", "BAR_CHART", "TREND_LINE"] },
  { key: "issues.maintenance",        label: "Maintenance Issues",      description: "Issues categorized as maintenance in the period",     defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD", "BAR_CHART"] },
  { key: "team.reporters",            label: "Top Reporters",           description: "Users who reported the most issues",                  defaultVisualType: "LEADERBOARD",supportedVisualTypes: ["LEADERBOARD"] },
  { key: "team.resolvers",            label: "Top Resolvers",           description: "Users who resolved the most issues",                  defaultVisualType: "LEADERBOARD",supportedVisualTypes: ["LEADERBOARD"] },
  { key: "customer_voice.feedback",   label: "Customer Feedback",       description: "Customer feedback submissions in the period",         defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD", "TREND_LINE"] },
  { key: "customer_voice.avg_rating", label: "Avg Customer Rating",     description: "Average customer satisfaction rating",                defaultVisualType: "KPI_CARD",   supportedVisualTypes: ["KPI_CARD"] },
  { key: "issues.benchmark",          label: "Issues by Location",      description: "Compare issue count across all locations",            defaultVisualType: "BENCHMARK",  supportedVisualTypes: ["BENCHMARK"], section: "Benchmarking" },
  { key: "issues.resolution_benchmark", label: "Resolution Rate by Location", description: "Compare resolution rates across locations",     defaultVisualType: "BENCHMARK",  supportedVisualTypes: ["BENCHMARK"], section: "Benchmarking" },
  { key: "issues.open_benchmark",     label: "Open Issues by Location", description: "Compare open issue counts across locations",          defaultVisualType: "BENCHMARK",  supportedVisualTypes: ["BENCHMARK"], section: "Benchmarking" },
]

export const DASHBOARD_TEMPLATES: Array<{
  key: string
  name: string
  description: string
  category: string
  widgets: WidgetConfig[]
}> = [
  {
    key: "operations_overview",
    name: "Operations Overview",
    description: "Key issue KPIs, open vs resolved, and resolution trends for daily operations.",
    category: "OPERATIONS",
    widgets: [
      { id: "t1-w1", metricKey: "issues.count",               visualType: "KPI_CARD",   title: "Total Issues",          width: 1, position: 0 },
      { id: "t1-w2", metricKey: "issues.open",                visualType: "KPI_CARD",   title: "Open Issues",           width: 1, position: 1 },
      { id: "t1-w3", metricKey: "issues.resolution_rate",     visualType: "KPI_CARD",   title: "Resolution Rate",       width: 1, position: 2 },
      { id: "t1-w4", metricKey: "issues.avg_resolution_time", visualType: "KPI_CARD",   title: "Avg Resolution Time",   width: 1, position: 3 },
      { id: "t1-w5", metricKey: "assignments.overdue",        visualType: "KPI_CARD",   title: "Overdue Assignments",   width: 1, position: 4 },
      { id: "t1-w6", metricKey: "issues.count",               visualType: "BAR_CHART",  title: "Issues by Status",      width: 2, position: 5 },
      { id: "t1-w7", metricKey: "issues.resolved",            visualType: "TREND_LINE", title: "Resolution Trend",      width: 3, position: 6 },
    ],
  },
  {
    key: "safety_focus",
    name: "Safety Focus",
    description: "Safety issue KPIs, overdue safety items, and safety trends by location.",
    category: "SAFETY",
    widgets: [
      { id: "t2-w1", metricKey: "issues.safety",              visualType: "KPI_CARD",   title: "Safety Issues",         width: 1, position: 0 },
      { id: "t2-w2", metricKey: "issues.overdue",             visualType: "KPI_CARD",   title: "Overdue Safety Items",  width: 1, position: 1 },
      { id: "t2-w3", metricKey: "issues.resolution_rate",     visualType: "KPI_CARD",   title: "Resolution Rate",       width: 1, position: 2 },
      { id: "t2-w4", metricKey: "issues.safety",              visualType: "BAR_CHART",  title: "Safety Issues by Status",width: 2, position: 3 },
      { id: "t2-w5", metricKey: "issues.safety",              visualType: "TREND_LINE", title: "Safety Issue Trend",    width: 3, position: 4 },
      { id: "t2-w6", metricKey: "issues.overdue",             visualType: "LEADERBOARD",title: "Overdue by Category",   width: 2, position: 5 },
    ],
  },
  {
    key: "team_performance",
    name: "Team Performance",
    description: "Top issue reporters and resolvers, assignments completed, and average resolution time.",
    category: "TEAM",
    widgets: [
      { id: "t3-w1", metricKey: "team.reporters",             visualType: "LEADERBOARD",title: "Top Reporters",         width: 2, position: 0 },
      { id: "t3-w2", metricKey: "team.resolvers",             visualType: "LEADERBOARD",title: "Top Resolvers",         width: 2, position: 1 },
      { id: "t3-w3", metricKey: "assignments.completed",      visualType: "KPI_CARD",   title: "Assignments Completed", width: 1, position: 2 },
      { id: "t3-w4", metricKey: "assignments.overdue",        visualType: "KPI_CARD",   title: "Overdue Assignments",   width: 1, position: 3 },
      { id: "t3-w5", metricKey: "issues.avg_resolution_time", visualType: "KPI_CARD",   title: "Avg Resolution Time",   width: 1, position: 4 },
      { id: "t3-w6", metricKey: "assignments.completed",      visualType: "TREND_LINE", title: "Completion Trend",      width: 3, position: 5 },
    ],
  },
  {
    key: "quality_maintenance",
    name: "Quality and Maintenance",
    description: "Maintenance KPIs, equipment issues, resolution time trends, and open issues by category.",
    category: "QUALITY",
    widgets: [
      { id: "t4-w1", metricKey: "issues.maintenance",         visualType: "KPI_CARD",   title: "Maintenance Issues",    width: 1, position: 0 },
      { id: "t4-w2", metricKey: "issues.overdue",             visualType: "KPI_CARD",   title: "Overdue Issues",        width: 1, position: 1 },
      { id: "t4-w3", metricKey: "issues.avg_resolution_time", visualType: "KPI_CARD",   title: "Avg Resolution Time",   width: 1, position: 2 },
      { id: "t4-w4", metricKey: "issues.maintenance",         visualType: "BAR_CHART",  title: "Maintenance by Status", width: 2, position: 3 },
      { id: "t4-w5", metricKey: "issues.count",               visualType: "DATA_TABLE", title: "Open by Category",      width: 2, position: 4 },
    ],
  },
  {
    key: "customer_voice",
    name: "Customer Voice",
    description: "Customer feedback KPI, feedback by source, avg rating, and feedback trend.",
    category: "CUSTOM",
    widgets: [
      { id: "t5-w1", metricKey: "customer_voice.feedback",    visualType: "KPI_CARD",   title: "Customer Feedback",     width: 1, position: 0 },
      { id: "t5-w2", metricKey: "customer_voice.avg_rating",  visualType: "KPI_CARD",   title: "Avg Rating",            width: 1, position: 1 },
      { id: "t5-w3", metricKey: "issues.resolution_rate",     visualType: "KPI_CARD",   title: "Resolution Rate",       width: 1, position: 2 },
      { id: "t5-w4", metricKey: "customer_voice.feedback",    visualType: "TREND_LINE", title: "Feedback Trend",        width: 3, position: 3 },
    ],
  },
  {
    key: "executive_summary",
    name: "Executive Summary",
    description: "All key KPIs in one view with issues by location, resolution rate trend, and open vs resolved.",
    category: "CUSTOM",
    widgets: [
      { id: "t6-w1", metricKey: "issues.count",               visualType: "KPI_CARD",   title: "Total Issues",          width: 1, position: 0 },
      { id: "t6-w2", metricKey: "issues.open",                visualType: "KPI_CARD",   title: "Open Issues",           width: 1, position: 1 },
      { id: "t6-w3", metricKey: "issues.resolution_rate",     visualType: "KPI_CARD",   title: "Resolution Rate",       width: 1, position: 2 },
      { id: "t6-w4", metricKey: "issues.avg_resolution_time", visualType: "KPI_CARD",   title: "Avg Resolution Time",   width: 1, position: 3 },
      { id: "t6-w5", metricKey: "assignments.completed",      visualType: "KPI_CARD",   title: "Assignments Done",      width: 1, position: 4 },
      { id: "t6-w6", metricKey: "suggestions.implemented",    visualType: "KPI_CARD",   title: "Suggestions Actioned",  width: 1, position: 5 },
      { id: "t6-w7", metricKey: "issues.benchmark",           visualType: "BENCHMARK",  title: "Issues by Location",    width: 3, position: 6 },
      { id: "t6-w8", metricKey: "issues.resolved",            visualType: "TREND_LINE", title: "Resolution Trend",      width: 3, position: 7 },
    ],
  },
]

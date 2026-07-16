"use client"

import { useState, useEffect, useCallback } from "react"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts"
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, Clock,
  MapPin, Building2, BarChart2, RefreshCw, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  period: string
  scope: string
  total: number
  byStatus: Array<{ status: string; count: number }>
  byCategory: Array<{ category: string; count: number }>
  byPriority: Array<{ priority: string; count: number }>
  avgResolutionDays: number | null
  trend: Array<{ month: string; total: number; resolved: number }>
  trending: Array<{ category: string; current: number; previous: number; changePercent: number | null }>
  bottlenecks: Array<{ category: string; avgDaysUnassigned: number }>
  repeatIssues: Array<{ title: string; count: number }>
  locationPerformance: Array<{ id: string; name: string; total: number; avgResolutionDays: number | null }>
  resolutionIntelligence: Array<{
    category: string; resolvedCount: number; avgCost: number | null;
    avgDays: number | null; topMethod: string | null
  }>
}

interface BenchmarkData {
  industryBucket: string | null
  deptBenchmarks: Array<{ id: string; name: string; avgResolutionDays: number | null; total: number }>
  locationBenchmarks: Array<{ id: string; name: string; avgResolutionDays: number | null; total: number }>
  industryComparison: Array<{
    category: string; industryAvgDays: number | null; industryCount: number;
    orgAvgDays: number | null; orgCount: number; vsIndustryPct: number | null
  }>
}

interface Props {
  role: string
  defaultScope: string
  locations: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string }>
}

// ── Colours ───────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  MAINTENANCE: "#3b82f6",
  SAFETY: "#ef4444",
  EQUIPMENT_BREAKDOWN: "#f97316",
  SUPPLY_SHORTAGE: "#a855f7",
  CUSTOMER_COMPLAINT: "#ec4899",
  EMPLOYEE: "#14b8a6",
  FACILITY: "#6366f1",
  GENERAL: "#64748b",
}
const PALETTE = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316"]

function categoryColor(cat: string, idx: number) {
  return CATEGORY_COLORS[cat] ?? PALETTE[idx % PALETTE.length]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCat(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtDays(d: number | null) {
  if (d === null || d === undefined) return "—"
  return `${Math.round(d * 10) / 10}d`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color = "blue" }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color?: string
}) {
  const bg = { blue: "bg-blue-50", green: "bg-green-50", amber: "bg-amber-50", red: "bg-red-50" }[color] ?? "bg-blue-50"
  const ic = { blue: "text-blue-600", green: "text-green-600", amber: "text-amber-600", red: "text-red-600" }[color] ?? "text-blue-600"
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", bg)}>
        <Icon className={cn("w-5 h-5", ic)} />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-400">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-gray-900 mb-3">{children}</h2>
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-gray-400 text-xs">—</span>
  if (pct > 0) return (
    <span className="flex items-center gap-0.5 text-red-600 text-xs font-medium">
      <TrendingUp className="w-3 h-3" /> +{pct}%
    </span>
  )
  if (pct < 0) return (
    <span className="flex items-center gap-0.5 text-green-600 text-xs font-medium">
      <TrendingDown className="w-3 h-3" /> {pct}%
    </span>
  )
  return <span className="flex items-center gap-0.5 text-gray-400 text-xs"><Minus className="w-3 h-3" /> 0%</span>
}

// ── Main component ────────────────────────────────────────────────────────────

export function AnalyticsClient({ role, defaultScope, locations, departments }: Props) {
  const [period, setPeriod] = useState("30d")
  const [scope, setScope] = useState(defaultScope)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [benchmarks, setBenchmarks] = useState<BenchmarkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "trends" | "benchmarks" | "insights">("overview")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [anaRes, benchRes] = await Promise.all([
        fetch(`/api/analytics?period=${period}&scope=${scope}`),
        fetch(`/api/analytics/benchmarks?period=${period}`),
      ])
      if (anaRes.ok) setData(await anaRes.json())
      if (benchRes.ok) setBenchmarks(await benchRes.json())
    } finally {
      setLoading(false)
    }
  }, [period, scope])

  useEffect(() => { fetchData() }, [fetchData])

  const openCount = data?.byStatus.find((s) => s.status === "OPEN")?.count ?? 0
  const resolvedCount = data?.byStatus.find((s) => s.status === "RESOLVED")?.count ?? 0

  const canSelectScope = role === "ADMIN" || role === "MANAGER"

  return (
    <div className="space-y-5 max-w-7xl">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {(["7d", "30d", "90d", "1y"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                period === p ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-900"
              )}
            >{p}</button>
          ))}
        </div>

        {/* Scope selector */}
        {canSelectScope && (
          <div className="relative">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="org">Entire Organization</option>
              {locations.map((l) => (
                <option key={l.id} value={`loc:${l.id}`}>{l.name}</option>
              ))}
              {departments.map((d) => (
                <option key={d.id} value={`dept:${d.id}`}>{d.name} dept.</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        )}

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-gray-900 border border-gray-200 rounded-lg bg-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-gray-200">
        {(["overview", "trends", "benchmarks", "insights"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize",
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-400 hover:text-gray-900"
            )}
          >{tab}</button>
        ))}
      </div>

      {loading && (
        <div className="py-16 text-center text-gray-400 text-sm">Loading analytics…</div>
      )}

      {!loading && data && (
        <>
          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Issues" value={data.total} icon={BarChart2} color="blue" />
                <StatCard label="Open" value={openCount} sub={`${data.total > 0 ? Math.round((openCount/data.total)*100) : 0}% of total`} icon={AlertTriangle} color="amber" />
                <StatCard label="Resolved" value={resolvedCount} icon={TrendingDown} color="green" />
                <StatCard
                  label="Avg Resolution"
                  value={data.avgResolutionDays !== null ? `${Math.round(data.avgResolutionDays * 10) / 10}d` : "—"}
                  icon={Clock}
                  color={data.avgResolutionDays !== null && data.avgResolutionDays > 5 ? "red" : "green"}
                />
              </div>

              {/* Status + Category */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Status pie */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <SectionTitle>Status Breakdown</SectionTitle>
                  {data.byStatus.length === 0
                    ? <p className="text-sm text-gray-400 py-8 text-center">No data</p>
                    : (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={data.byStatus}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                            labelLine={false}
                          >
                            {data.byStatus.map((_, i) => (
                              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                </div>

                {/* Category bar */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <SectionTitle>By Category</SectionTitle>
                  {data.byCategory.length === 0
                    ? <p className="text-sm text-gray-400 py-8 text-center">No data</p>
                    : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data.byCategory} layout="vertical" margin={{ left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={110}
                            tickFormatter={fmtCat} />
                          <Tooltip formatter={(v) => [v, "Issues"]} labelFormatter={(l: unknown) => fmtCat(String(l))} />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                            {data.byCategory.map((r, i) => (
                              <Cell key={i} fill={categoryColor(r.category, i)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                </div>
              </div>

              {/* Bottlenecks */}
              {data.bottlenecks.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <SectionTitle>Bottleneck Analysis — Unassigned Issues</SectionTitle>
                  <div className="space-y-2">
                    {data.bottlenecks.map((b, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-600">{fmtCat(b.category)}</span>
                        <span className={cn("text-sm font-semibold", b.avgDaysUnassigned > 3 ? "text-red-600" : "text-amber-600")}>
                          Avg {fmtDays(b.avgDaysUnassigned)} waiting
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Repeat issues */}
              {data.repeatIssues.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <SectionTitle>Repeat Issues</SectionTitle>
                  <div className="space-y-1.5">
                    {data.repeatIssues.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">{r.count}</span>
                        <span className="text-sm text-gray-600 truncate">{r.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TRENDS ── */}
          {activeTab === "trends" && (
            <div className="space-y-5">
              {/* Monthly trend line chart */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <SectionTitle>Issue Volume Over Time</SectionTitle>
                {data.trend.length === 0
                  ? <p className="text-sm text-gray-400 py-8 text-center">No trend data for this period</p>
                  : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={data.trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} name="Submitted" />
                        <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} dot={false} name="Resolved" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
              </div>

              {/* Category trending */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <SectionTitle>Trending by Category (vs Prior Half-Period)</SectionTitle>
                {data.trending.length === 0
                  ? <p className="text-sm text-gray-400 py-8 text-center">No data</p>
                  : (
                    <div className="space-y-1">
                      {data.trending
                        .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
                        .map((t, i) => (
                          <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: categoryColor(t.category, i) }} />
                              <span className="text-sm text-gray-600">{fmtCat(t.category)}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-gray-400">{t.previous} → {t.current}</span>
                              <TrendBadge pct={t.changePercent} />
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
              </div>

              {/* Location performance (admin org scope) */}
              {data.locationPerformance.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <SectionTitle>Location Performance</SectionTitle>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.locationPerformance} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="d" />
                      <Tooltip formatter={(v) => [`${v}d`, "Avg Resolution"]} />
                      <Bar dataKey="avgResolutionDays" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Avg Resolution Days" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── BENCHMARKS ── */}
          {activeTab === "benchmarks" && benchmarks && (
            <div className="space-y-5" data-tour="benchmarks-panel">
              {/* Industry comparison */}
              {benchmarks.industryComparison.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <SectionTitle>
                    Industry Benchmarking
                    {benchmarks.industryBucket && (
                      <span className="ml-2 text-xs font-normal text-gray-400">({benchmarks.industryBucket})</span>
                    )}
                  </SectionTitle>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Category</th>
                          <th className="text-right py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Your Avg</th>
                          <th className="text-right py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Industry Avg</th>
                          <th className="text-right py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Vs Industry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benchmarks.industryComparison.map((row, i) => (
                          <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition-colors">
                            <td className="py-2.5 text-gray-600">{fmtCat(row.category)}</td>
                            <td className="py-2.5 text-right text-gray-600">{fmtDays(row.orgAvgDays)}</td>
                            <td className="py-2.5 text-right text-gray-400">{fmtDays(row.industryAvgDays)}</td>
                            <td className="py-2.5 text-right">
                              {row.vsIndustryPct === null ? (
                                <span className="text-gray-400">—</span>
                              ) : row.vsIndustryPct > 0 ? (
                                <span className="text-red-600 font-medium">+{row.vsIndustryPct}% slower</span>
                              ) : row.vsIndustryPct < 0 ? (
                                <span className="text-green-600 font-medium">{Math.abs(row.vsIndustryPct)}% faster</span>
                              ) : (
                                <span className="text-gray-400">On par</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Department benchmarks */}
              {benchmarks.deptBenchmarks.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <SectionTitle>Department Benchmarks</SectionTitle>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={benchmarks.deptBenchmarks} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} unit="d" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip formatter={(v) => [`${v}d`, "Avg Resolution"]} />
                      <Bar dataKey="avgResolutionDays" fill="#6366f1" radius={[0, 4, 4, 0]} name="Avg Resolution Days" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Location benchmarks */}
              {benchmarks.locationBenchmarks.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <SectionTitle>Location Benchmarks</SectionTitle>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={benchmarks.locationBenchmarks} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} unit="d" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip formatter={(v) => [`${v}d`, "Avg Resolution"]} />
                      <Bar dataKey="avgResolutionDays" fill="#10b981" radius={[0, 4, 4, 0]} name="Avg Resolution Days" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {benchmarks.industryComparison.length === 0 &&
               benchmarks.deptBenchmarks.length === 0 &&
               benchmarks.locationBenchmarks.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center">
                  <BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No benchmark data available yet.</p>
                  <p className="text-gray-300 text-xs mt-1">Benchmarks populate as issues are resolved and industry data accumulates.</p>
                </div>
              )}
            </div>
          )}

          {/* ── INSIGHTS ── */}
          {activeTab === "insights" && (
            <div className="space-y-5">
              {/* Resolution intelligence */}
              {data.resolutionIntelligence.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <SectionTitle>Resolution Intelligence</SectionTitle>
                  <p className="text-xs text-gray-400 mb-4">Based on resolved issues with tracked resolution methods.</p>
                  <div className="space-y-4">
                    {data.resolutionIntelligence.map((r, i) => (
                      <div key={i} className="border border-gray-100 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: categoryColor(r.category, i) }} />
                          <span className="font-medium text-sm text-gray-900">{fmtCat(r.category)}</span>
                          <span className="text-xs text-gray-400">({r.resolvedCount} resolved)</span>
                        </div>
                        {r.topMethod && (
                          <p className="text-sm text-gray-600 mb-1.5">
                            Top resolution method: <span className="font-medium text-gray-900">{r.topMethod}</span>
                          </p>
                        )}
                        <div className="flex gap-4 text-xs text-gray-400">
                          {r.avgDays !== null && (
                            <span>Avg time: <span className="text-gray-600 font-medium">{fmtDays(r.avgDays)}</span></span>
                          )}
                          {r.avgCost !== null && (
                            <span>Avg cost: <span className="text-gray-600 font-medium">${Math.round(r.avgCost)}</span></span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center">
                  <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No resolution intelligence yet.</p>
                  <p className="text-gray-300 text-xs mt-1">
                    Resolution methods and costs are captured when issues are resolved.
                  </p>
                </div>
              )}

              {/* Priority breakdown */}
              {data.byPriority.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <SectionTitle>Priority Distribution</SectionTitle>
                  <div className="flex gap-3 flex-wrap">
                    {data.byPriority.map((p, i) => {
                      const colors: Record<string, string> = {
                        CRITICAL: "bg-red-100 text-red-700 border-red-200",
                        HIGH: "bg-orange-100 text-orange-700 border-orange-200",
                        MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
                        LOW: "bg-green-100 text-green-700 border-green-200",
                      }
                      return (
                        <div key={i} className={cn("px-4 py-3 rounded-lg border text-center min-w-[90px]", colors[p.priority] ?? "bg-gray-100 text-gray-600 border-gray-200")}>
                          <div className="text-xl font-bold">{p.count}</div>
                          <div className="text-xs font-medium mt-0.5">{p.priority}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

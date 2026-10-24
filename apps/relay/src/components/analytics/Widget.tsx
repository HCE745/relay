"use client"

import { useState, useEffect, useCallback } from "react"
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from "recharts"
import type { WidgetConfig, MetricResult } from "@/lib/analytics/types"
import { Loader2, AlertCircle, GripVertical, X } from "lucide-react"

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"]

interface WidgetProps {
  config: WidgetConfig
  dateRange: { start: string; end: string }
  editMode?: boolean
  onRemove?: (id: string) => void
}

interface FetchState {
  result: MetricResult | null
  loading: boolean
  error: string | null
}

export function Widget({ config, dateRange, editMode, onRemove }: WidgetProps) {
  const [state, setState] = useState<FetchState>({ result: null, loading: true, error: null })

  const fetchData = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    const params = new URLSearchParams({
      metricKey:  config.metricKey,
      visualType: config.visualType,
      start:      dateRange.start,
      end:        dateRange.end,
    })
    if (config.filters) params.set("filters", JSON.stringify(config.filters))

    try {
      const res = await fetch(`/api/analytics/widget?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setState({ result: null, loading: false, error: body.error ?? "Failed to load" })
        return
      }
      const data = await res.json() as { result: MetricResult }
      setState({ result: data.result, loading: false, error: null })
    } catch {
      setState({ result: null, loading: false, error: "Network error" })
    }
  }, [config.metricKey, config.visualType, config.filters, dateRange.start, dateRange.end])

  useEffect(() => { fetchData() }, [fetchData])

  const colSpan = config.width === 3 ? "col-span-3" : config.width === 2 ? "col-span-2" : "col-span-1"

  return (
    <div className={`${colSpan} bg-white rounded-xl border border-gray-200 p-5 flex flex-col min-h-[160px] relative group`}>
      {/* Edit mode controls */}
      {editMode && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="cursor-grab p-1 text-gray-400 hover:text-gray-600">
            <GripVertical className="w-4 h-4" />
          </div>
          <button
            onClick={() => onRemove?.(config.id)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <p className="text-sm font-semibold text-gray-700 mb-3 pr-12 truncate">{config.title ?? config.metricKey}</p>

      <div className="flex-1 flex items-center justify-center min-h-[80px]">
        {state.loading && <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />}
        {state.error && !state.loading && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
        {!state.loading && !state.error && state.result && (
          <WidgetContent config={config} result={state.result} />
        )}
      </div>
    </div>
  )
}

function WidgetContent({ config, result }: { config: WidgetConfig; result: MetricResult }) {
  if (config.visualType === "KPI_CARD") {
    if (result.type !== "scalar") return <NoData />
    return (
      <div className="text-center">
        <p className="text-4xl font-bold text-gray-900 tabular-nums">
          {result.value.toLocaleString()}
          {result.unit && <span className="text-2xl text-gray-500 ml-1">{result.unit}</span>}
        </p>
        {result.change != null && (
          <p className={`text-sm mt-1 ${result.change >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {result.change >= 0 ? "+" : ""}{result.change}% vs prior period
          </p>
        )}
      </div>
    )
  }

  if (config.visualType === "BAR_CHART") {
    if (result.type !== "series") return <NoData />
    if (result.data.length === 0) return <NoData />
    return (
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={result.data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {result.data.map((entry, i) => (
              <Cell key={entry.label} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (config.visualType === "TREND_LINE") {
    if (result.type !== "series") return <NoData />
    if (result.data.length === 0) return <NoData />
    return (
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={result.data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (config.visualType === "LEADERBOARD") {
    if (result.type !== "ranked") return <NoData />
    if (result.items.length === 0) return <NoData />
    return (
      <div className="w-full space-y-1.5">
        {result.items.slice(0, 8).map(item => (
          <div key={item.rank} className="flex items-center gap-2 text-sm">
            <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
              {item.rank}
            </span>
            <span className="flex-1 truncate text-gray-700">{item.label}</span>
            <span className="font-semibold text-gray-900 tabular-nums">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )
  }

  if (config.visualType === "DATA_TABLE") {
    if (result.type !== "table") return <NoData />
    if (result.rows.length === 0) return <NoData />
    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              {result.columns.map(col => (
                <th key={col.key} className="text-left py-1 pr-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.slice(0, 8).map((row, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                {result.columns.map(col => (
                  <td key={col.key} className="py-1.5 pr-3 text-gray-700 tabular-nums">
                    {row[col.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (config.visualType === "BENCHMARK") {
    if (result.type !== "benchmark") return <NoData />
    if (result.locations.length === 0) return <NoData />
    const unit = result.unit ?? ""
    return (
      <div className="w-full space-y-1">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>Location</span>
          <span>Org avg: {result.orgAverage}{unit}</span>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(80, result.locations.length * 22)}>
          <BarChart data={result.locations} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={80} />
            <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v) => [`${v}${unit}`, ""]} />
            <ReferenceLine x={result.orgAverage} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: "avg", position: "insideTopRight", fontSize: 9, fill: "#f59e0b" }} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]}>
              {result.locations.map((entry, i) => (
                <Cell key={entry.label} fill={entry.value > result.orgAverage ? "#3b82f6" : "#94a3b8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return <NoData />
}

function NoData() {
  return <p className="text-sm text-gray-400">No data for this period</p>
}

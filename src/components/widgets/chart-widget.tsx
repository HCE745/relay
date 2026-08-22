"use client"

import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"
import type { ChartDataPoint, ChartType } from "@/lib/widget-registry"

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"]

const STATUS_COLORS: Record<string, string> = {
  OPEN:         "#3b82f6",
  "IN PROGRESS":"#f59e0b",
  RESOLVED:     "#10b981",
  CLOSED:       "#6b7280",
  ESCALATED:    "#ef4444",
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH:     "#f97316",
  MEDIUM:   "#f59e0b",
  LOW:      "#6b7280",
}

function sliceColor(label: string, idx: number): string {
  return STATUS_COLORS[label] ?? PRIORITY_COLORS[label] ?? PALETTE[idx % PALETTE.length]
}

interface ChartWidgetProps {
  chartType: ChartType
  title?:    string
  data:      ChartDataPoint[]
}

export function ChartWidget({ chartType, title, data }: ChartWidgetProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 h-full flex flex-col">
        {title && <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>}
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400">No data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full flex flex-col">
      {title && <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>}
      <div className="flex-1 min-h-[160px]">
        {chartType === "bar" && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={entry.label} fill={sliceColor(entry.label, i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {chartType === "line" && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {chartType === "pie" && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius="70%"
                innerRadius="35%"
                paddingAngle={2}
              >
                {data.map((entry, i) => (
                  <Cell key={entry.label} fill={sliceColor(entry.label, i)} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v, name) => [v, name]} />
              <Legend
                formatter={(value: string) => <span style={{ fontSize: 11 }}>{value}</span>}
                iconSize={10}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

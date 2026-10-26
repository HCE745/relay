"use client"

import { useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList } from "recharts"
import { TrendingUp, Loader2, Users, Mail, Calendar, DollarSign } from "lucide-react"

interface FunnelStage { stage: string; count: number; convRate: number | null }
interface CampaignData {
  funnel:         FunnelStage[]
  sequenceStats:  Array<{ id: string; name: string; enrolled: number; emailsSent: number }>
  avgDaysToClose: number | null
  abCampaigns:    Array<{ id: string; name: string; results: Array<{ variant: string; emailsSent: number; replyRate: number }> }>
  repStats:       Array<{ id: string; name: string; emailsSent: number; demos: number; won: number }> | null
  period:         string
  totalProspects: number
}

const PERIOD_OPTIONS = [
  { value: "7d",  label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
]

const FUNNEL_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#10b981"]

export default function CampaignsPage() {
  const [data, setData]     = useState<CampaignData | null>(null)
  const [period, setPeriod] = useState("30d")
  const [loading, setLoading] = useState(true)

  async function load(p: string) {
    setLoading(true)
    const res = await fetch(`/api/sales/campaigns?period=${p}`)
    if (res.ok) {
      const d = await res.json() as CampaignData
      setData(d)
    }
    setLoading(false)
  }

  useEffect(() => { void load(period) }, [period])

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            Campaign Reporting
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Outreach performance across all channels</p>
        </div>
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setPeriod(o.value)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                period === o.value ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading campaign data...
        </div>
      ) : !data ? (
        <p className="text-gray-500 text-sm">Failed to load data.</p>
      ) : (
        <>
          {/* Funnel */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Conversion Funnel</h2>
            <div className="flex items-end gap-3 justify-center">
              {data.funnel.map((stage, i) => (
                <div key={stage.stage} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className="text-xs font-bold text-white">{stage.count.toLocaleString()}</span>
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{
                      height: Math.max(24, (stage.count / (data.funnel[0]?.count || 1)) * 140),
                      backgroundColor: FUNNEL_COLORS[i],
                      opacity: 0.8 + i * 0.04,
                    }}
                  />
                  <span className="text-[10px] text-gray-400 text-center leading-tight">{stage.stage}</span>
                  {stage.convRate !== null && (
                    <span className="text-[10px] text-emerald-400 font-semibold">{stage.convRate}%</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Total Prospects" value={data.totalProspects.toLocaleString()} icon={Users} />
            <KpiCard label="Contacted" value={(data.funnel[0]?.count ?? 0).toLocaleString()} icon={Mail} />
            <KpiCard label="Avg Days to Close" value={data.avgDaysToClose != null ? `${data.avgDaysToClose}d` : "—"} icon={Calendar} />
            <KpiCard label="Closed Won" value={(data.funnel[4]?.count ?? 0).toLocaleString()} icon={DollarSign} />
          </div>

          {/* Sequence performance */}
          {data.sequenceStats.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Sequence Performance</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {["Sequence", "Enrolled", "Emails Sent"].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.sequenceStats.map(s => (
                      <tr key={s.id} className="border-b border-gray-800/50 last:border-0">
                        <td className="py-2.5 px-3 text-gray-200">{s.name}</td>
                        <td className="py-2.5 px-3 text-gray-400 tabular-nums">{s.enrolled}</td>
                        <td className="py-2.5 px-3 text-gray-400 tabular-nums">{s.emailsSent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* A/B test summary */}
          {data.abCampaigns.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">A/B Test Performance</h2>
              <div className="space-y-3">
                {data.abCampaigns.map(c => {
                  const best = c.results.reduce((b, r) => Number(r.replyRate) > Number(b.replyRate) ? r : b, c.results[0] ?? { variant: "—", replyRate: 0 })
                  return (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                      <span className="text-xs text-gray-300">{c.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{c.results.reduce((s, r) => s + r.emailsSent, 0)} sent</span>
                        <span className="text-xs text-emerald-400 font-semibold">Best: {best.variant} ({Number(best.replyRate).toFixed(1)}% reply)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rep performance (manager only) */}
          {data.repStats && data.repStats.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Rep Performance</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.repStats} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#6b7280" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", fontSize: 11 }} />
                  <Bar dataKey="emailsSent" name="Emails Sent" fill="#3b82f6" radius={[3,3,0,0]} />
                  <Bar dataKey="demos"      name="Active Opps"  fill="#10b981" radius={[3,3,0,0]} />
                  <Bar dataKey="won"        name="Won"          fill="#f59e0b" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-500" />
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

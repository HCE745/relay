"use client"

import { useState } from "react"
import { FlaskConical, Plus, ChevronLeft, Trophy, TrendingUp, Send, Eye, MousePointerClick, MessageSquareReply, X, Loader2, Check } from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { formatDistanceToNow } from "date-fns"

interface AbTestResult {
  id: string
  campaignId: string
  variant: string
  emailsSent: number
  emailsOpened: number
  linksClicked: number
  repliesReceived: number
  openRate: number
  clickRate: number
  replyRate: number
}

interface Campaign {
  id: string
  name: string
  description: string | null
  variants: Array<{ label: string; subject: string; body: string }>
  isActive: boolean
  createdAt: string
  results: AbTestResult[]
  _count: { emails: number }
}

interface Template {
  id: string
  name: string
  subject: string
  body: string
}

interface Props {
  campaigns: Campaign[]
  templates: Template[]
}

const VARIANT_LABELS = ["A", "B", "C", "D"]
const VARIANT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"]

export function AbTestsClient({ campaigns: initialCampaigns, templates }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [selected, setSelected] = useState<Campaign | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [variantCount, setVariantCount] = useState(2)
  const [variantData, setVariantData] = useState<Array<{ label: string; subject: string; body: string }>>([
    { label: "A", subject: "", body: "" },
    { label: "B", subject: "", body: "" },
  ])

  function addVariant() {
    if (variantCount >= 4) return
    const next = VARIANT_LABELS[variantCount]
    setVariantData(v => [...v, { label: next, subject: "", body: "" }])
    setVariantCount(c => c + 1)
  }

  function removeVariant(i: number) {
    if (variantCount <= 2) return
    setVariantData(v => v.filter((_, idx) => idx !== i).map((vd, idx) => ({ ...vd, label: VARIANT_LABELS[idx] })))
    setVariantCount(c => c - 1)
  }

  function loadTemplate(i: number, tpl: Template) {
    setVariantData(v => v.map((vd, idx) => idx === i ? { ...vd, subject: tpl.subject, body: tpl.body } : vd))
  }

  async function createCampaign() {
    if (!newName.trim() || variantData.some(v => !v.subject.trim() || !v.body.trim())) return
    setCreating(true)
    try {
      const res = await fetch("/api/sales/ab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDescription || undefined, variants: variantData }),
      })
      if (res.ok) {
        const campaign = await res.json() as Campaign
        campaign.results = variantData.map((v, i) => ({
          id: `tmp-${i}`, campaignId: campaign.id, variant: VARIANT_LABELS[i],
          emailsSent: 0, emailsOpened: 0, linksClicked: 0, repliesReceived: 0,
          openRate: 0, clickRate: 0, replyRate: 0,
        }))
        campaign._count = { emails: 0 }
        setCampaigns(prev => [campaign, ...prev])
        setShowCreate(false)
        setNewName("")
        setNewDescription("")
        setVariantCount(2)
        setVariantData([{ label: "A", subject: "", body: "" }, { label: "B", subject: "", body: "" }])
      }
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(campaign: Campaign) {
    const res = await fetch(`/api/sales/ab-tests/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !campaign.isActive }),
    })
    if (res.ok) {
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, isActive: !c.isActive } : c))
      if (selected?.id === campaign.id) setSelected(s => s ? { ...s, isActive: !s.isActive } : null)
    }
  }

  if (selected) {
    return <DetailView campaign={selected} onBack={() => setSelected(null)} onToggle={() => toggleActive(selected)} />
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-emerald-400" />
            A/B Tests
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-6 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl my-6">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">New A/B Campaign</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Campaign Name</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Q4 Cold Outreach Test"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Description (optional)</label>
                <input
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="What are you testing?"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Variant cards */}
              <div className="space-y-3">
                {variantData.map((v, i) => (
                  <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-white flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white`}
                          style={{ backgroundColor: VARIANT_COLORS[i] }}>
                          {v.label}
                        </span>
                        Variant {v.label}
                      </span>
                      <div className="flex items-center gap-2">
                        {templates.length > 0 && (
                          <select
                            className="text-xs bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-gray-300 focus:outline-none"
                            defaultValue=""
                            onChange={e => {
                              const tpl = templates.find(t => t.id === e.target.value)
                              if (tpl) loadTemplate(i, tpl)
                            }}
                          >
                            <option value="">Load from template...</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        )}
                        {variantCount > 2 && (
                          <button onClick={() => removeVariant(i)} className="text-gray-500 hover:text-red-400">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      value={v.subject}
                      onChange={e => setVariantData(vd => vd.map((x, idx) => idx === i ? { ...x, subject: e.target.value } : x))}
                      placeholder="Subject line"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <textarea
                      value={v.body}
                      onChange={e => setVariantData(vd => vd.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x))}
                      placeholder="Email body..."
                      rows={4}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm resize-y focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                ))}
              </div>

              {variantCount < 4 && (
                <button
                  onClick={addVariant}
                  className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add variant {VARIANT_LABELS[variantCount]}
                </button>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowCreate(false)} className="text-sm text-gray-400 hover:text-white px-4 py-2">
                Cancel
              </button>
              <button
                onClick={createCampaign}
                disabled={creating || !newName.trim() || variantData.some(v => !v.subject.trim() || !v.body.trim())}
                className="flex items-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-colors"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No A/B campaigns yet. Create one to start testing email variants.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const bestVariant = c.results.reduce((best, r) =>
              Number(r.replyRate) > Number(best.replyRate) ? r : best,
              c.results[0] ?? { variant: "—", replyRate: 0 }
            )
            const totalSent = c.results.reduce((s, r) => s + r.emailsSent, 0)
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="w-full bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 text-left transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white truncate">{c.name}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.isActive ? "bg-emerald-900/40 text-emerald-400" : "bg-gray-700 text-gray-400"}`}>
                        {c.isActive ? "Active" : "Paused"}
                      </span>
                    </div>
                    {c.description && <p className="text-xs text-gray-500 mb-2">{c.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Send className="w-3 h-3" />{totalSent} sent</span>
                      <span>{c.variants.length} variants</span>
                      <span>{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                  {totalSent > 0 && (
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-[10px] text-gray-500 mb-0.5">Best variant</p>
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: VARIANT_COLORS[VARIANT_LABELS.indexOf(bestVariant.variant)] }}>
                          {bestVariant.variant}
                        </span>
                        <span className="text-sm font-semibold text-white">{Number(bestVariant.replyRate).toFixed(1)}%</span>
                        <span className="text-xs text-gray-500">reply</span>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DetailView({ campaign, onBack, onToggle }: { campaign: Campaign; onBack: () => void; onToggle: () => void }) {
  const [detail, setDetail] = useState<{ trend: Array<Record<string, number | string>> } | null>(null)
  const [loading, setLoading] = useState(true)

  useState(() => {
    fetch(`/api/sales/ab-tests/${campaign.id}`)
      .then(r => r.json())
      .then(data => { setDetail(data); setLoading(false) })
      .catch(() => setLoading(false))
  })

  const results = campaign.results
  const bestResult = results.length > 0
    ? results.reduce((best, r) => Number(r.replyRate) > Number(best.replyRate) ? r : best, results[0])
    : null

  const totalSent = results.reduce((s, r) => s + r.emailsSent, 0)

  function recommendation() {
    if (!bestResult || totalSent < 5) return "Send at least 5 emails per variant before drawing conclusions."
    const best = results.find(r => r.variant === bestResult.variant)
    if (!best) return ""
    const rate = Number(best.replyRate)
    if (rate === 0) return "No replies yet. Keep sending and check back later."
    return `Variant ${best.variant} is performing best with a ${rate.toFixed(1)}% reply rate. Consider using it as your primary template.`
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{campaign.name}</h1>
          {campaign.description && <p className="text-gray-400 text-sm">{campaign.description}</p>}
        </div>
        <button
          onClick={onToggle}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            campaign.isActive
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-emerald-700 hover:bg-emerald-600 text-white"
          }`}
        >
          {campaign.isActive ? "Pause" : "Resume"}
        </button>
      </div>

      {/* Comparison table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl mb-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300">Variant Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {["Variant", "Sent", "Opens", "Open Rate", "Clicks", "Click Rate", "Replies", "Reply Rate"].map(h => (
                  <th key={h} className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const isWinner = bestResult?.variant === r.variant && totalSent >= 5 && Number(r.replyRate) > 0
                return (
                  <tr key={r.variant} className="border-b border-gray-800/50 last:border-0">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: VARIANT_COLORS[i] }}>
                          {r.variant}
                        </span>
                        {isWinner && (
                          <span className="flex items-center gap-1 bg-amber-900/30 text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            <Trophy className="w-3 h-3" />
                            Winner
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-200 tabular-nums">{r.emailsSent}</td>
                    <td className="py-3 px-4 text-gray-200 tabular-nums">{r.emailsOpened}</td>
                    <td className="py-3 px-4 tabular-nums">
                      <RateCell value={Number(r.openRate)} total={r.emailsSent} />
                    </td>
                    <td className="py-3 px-4 text-gray-200 tabular-nums">{r.linksClicked}</td>
                    <td className="py-3 px-4 tabular-nums">
                      <RateCell value={Number(r.clickRate)} total={r.emailsSent} />
                    </td>
                    <td className="py-3 px-4 text-gray-200 tabular-nums">{r.repliesReceived}</td>
                    <td className="py-3 px-4 tabular-nums">
                      <RateCell value={Number(r.replyRate)} total={r.emailsSent} highlight={isWinner} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex items-start gap-3">
        <TrendingUp className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-gray-300">{recommendation()}</p>
      </div>

      {/* Trend chart */}
      {detail && detail.trend && detail.trend.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Emails Sent Per Day</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={detail.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {campaign.variants.map((v, i) => (
                <Line key={v.label} type="monotone" dataKey={v.label} stroke={VARIANT_COLORS[i]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading details...
        </div>
      )}

      {/* Variant definitions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300">Variant Copy</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {campaign.variants.map((v, i) => (
            <div key={v.label} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: VARIANT_COLORS[i] }}>
                  {v.label}
                </span>
                <span className="text-sm font-medium text-gray-300">{v.subject}</span>
              </div>
              <p className="text-xs text-gray-500 whitespace-pre-line line-clamp-3">{v.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RateCell({ value, total, highlight }: { value: number; total: number; highlight?: boolean }) {
  if (total === 0) return <span className="text-gray-600">—</span>
  return (
    <span className={highlight ? "font-semibold text-emerald-400" : "text-gray-200"}>
      {value.toFixed(1)}%
    </span>
  )
}

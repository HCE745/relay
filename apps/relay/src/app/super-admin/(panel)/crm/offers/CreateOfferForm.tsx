"use client"

import { useState } from "react"
import { Plus, Tag, Copy, CheckCircle2, Loader2 } from "lucide-react"

const PLAN_OPTIONS = [
  { value: "essentials",        label: "Essentials" },
  { value: "professional",      label: "Professional" },
  { value: "professional_plus", label: "Professional Plus" },
  { value: "wash_essentials",   label: "Wash Essentials" },
]

export function CreateOfferForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen]                   = useState(false)
  const [offerType, setOfferType]         = useState("PERCENT_DISCOUNT")
  const [discountPct, setDiscountPct]     = useState("15")
  const [flatPrice, setFlatPrice]         = useState("")
  const [freeMonths, setFreeMonths]       = useState("3")
  const [durationMonths, setDurationMonths] = useState("12")
  const [targetPlan, setTargetPlan]       = useState("professional")
  const [maxRedemptions, setMaxRedemptions] = useState("1")
  const [expiresAt, setExpiresAt]         = useState("")
  const [notes, setNotes]                 = useState("")
  const [saving, setSaving]               = useState(false)
  const [generatedUrl, setGeneratedUrl]   = useState<string | null>(null)
  const [copied, setCopied]               = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        offerType,
        targetPlan,
        maxRedemptions: Number(maxRedemptions) || 1,
        expiresAt:      expiresAt || undefined,
        notes:          notes.trim() || undefined,
      }
      if (offerType === "PERCENT_DISCOUNT") body.discountPercent = Number(discountPct)
      if (offerType === "FLAT_PRICE")        body.flatMonthlyPrice = Number(flatPrice)
      if (offerType === "FREE_MONTHS")       body.freeMonths = Number(freeMonths)
      if (offerType !== "FREE_MONTHS")       body.durationMonths = Number(durationMonths) || undefined

      const res = await fetch("/api/super-admin/crm/offers", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      const data = await res.json()
      setGeneratedUrl(data.offerUrl)
      onCreated()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create offer")
    } finally {
      setSaving(false)
    }
  }

  function copyUrl() {
    if (!generatedUrl) return
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (generatedUrl) {
    return (
      <div className="mb-6 p-4 bg-emerald-900/20 border border-emerald-700/40 rounded-xl space-y-3">
        <p className="text-sm font-medium text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Offer link generated
        </p>
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
          <p className="text-xs text-emerald-300 font-mono flex-1 truncate">{generatedUrl}</p>
          <button onClick={copyUrl} className="shrink-0 text-gray-400 hover:text-white transition-colors">
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={() => { setGeneratedUrl(null); setOpen(false) }}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          Create another
        </button>
      </div>
    )
  }

  return (
    <div className="mb-6">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Offer
        </button>
      ) : (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-400" />
              <p className="text-sm font-semibold text-white">New Offer</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Offer Type</label>
                <select
                  value={offerType}
                  onChange={e => setOfferType(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="PERCENT_DISCOUNT">% Discount</option>
                  <option value="FLAT_PRICE">Flat Monthly Price</option>
                  <option value="FREE_MONTHS">Free Months</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Plan</label>
                <select
                  value={targetPlan}
                  onChange={e => setTargetPlan(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {PLAN_OPTIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {offerType === "PERCENT_DISCOUNT" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Discount %</label>
                  <input
                    type="number" min={1} max={100} value={discountPct}
                    onChange={e => setDiscountPct(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Duration (months, blank = forever)</label>
                  <input
                    type="number" min={1} value={durationMonths}
                    onChange={e => setDurationMonths(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {offerType === "FLAT_PRICE" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Flat Price ($/month)</label>
                  <input
                    type="number" min={1} step={0.01} value={flatPrice}
                    onChange={e => setFlatPrice(e.target.value)}
                    placeholder="299"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {offerType === "FREE_MONTHS" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Free Months</label>
                  <input
                    type="number" min={1} max={24} value={freeMonths}
                    onChange={e => setFreeMonths(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Max Redemptions</label>
                <input
                  type="number" min={1} max={100} value={maxRedemptions}
                  onChange={e => setMaxRedemptions(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Expires (optional)</label>
                <input
                  type="date" value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Notes (optional)</label>
              <input
                type="text" value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Internal notes about this offer…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
              Generate Link
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { Save, Loader2, CheckCircle2 } from "lucide-react"

type OverviewData = {
  primaryContactName:  string
  primaryContactEmail: string
  plan:                string
  estimatedFacilities: number
  trialStartDate:      string | null
  internalNotes:       string | null
  organizationName:    string
}

type Props = {
  onboardingId: string
  isPostLaunch: boolean
  onReady:    () => void
  onNotReady: () => void
}

const PLAN_OPTIONS = ["essentials", "professional", "custom"] as const

export function StepOverview({ onboardingId, isPostLaunch, onReady, onNotReady }: Props) {
  const [data, setData]       = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [form, setForm] = useState({
    primaryContactName:  "",
    primaryContactEmail: "",
    plan:                "essentials",
    estimatedFacilities: "1",
    trialStartDate:      "",
    internalNotes:       "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}`)
      if (!res.ok) throw new Error("Failed to load")
      const json = await res.json() as OverviewData & { organization: { name: string } }
      const d: OverviewData = {
        primaryContactName:  json.primaryContactName,
        primaryContactEmail: json.primaryContactEmail,
        plan:                json.plan,
        estimatedFacilities: json.estimatedFacilities,
        trialStartDate:      json.trialStartDate,
        internalNotes:       json.internalNotes,
        organizationName:    json.organization.name,
      }
      setData(d)
      setForm({
        primaryContactName:  d.primaryContactName,
        primaryContactEmail: d.primaryContactEmail,
        plan:                d.plan,
        estimatedFacilities: String(d.estimatedFacilities),
        trialStartDate:      d.trialStartDate ? d.trialStartDate.split("T")[0] : "",
        internalNotes:       d.internalNotes ?? "",
      })
      const isReady = !!d.primaryContactEmail.trim() && !!d.trialStartDate
      isReady ? onReady() : onNotReady()
    } catch {
      setError("Failed to load customer info.")
    } finally {
      setLoading(false)
    }
  }, [onboardingId, onReady, onNotReady])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryContactName:  form.primaryContactName.trim(),
          primaryContactEmail: form.primaryContactEmail.trim().toLowerCase(),
          plan:                form.plan,
          estimatedFacilities: parseInt(form.estimatedFacilities, 10) || 1,
          trialStartDate:      form.trialStartDate || null,
          internalNotes:       form.internalNotes.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? "Save failed")
      }
      const updated = await res.json() as OverviewData
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      const isReady = !!updated.primaryContactEmail?.trim() && !!updated.trialStartDate
      isReady ? onReady() : onNotReady()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Org name (read-only) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Organization</p>
        <p className="text-base font-semibold text-white">{data?.organizationName}</p>
        <p className="text-xs text-gray-600 mt-0.5">Organization name is managed separately via the org settings page.</p>
      </div>

      {/* Contact info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Primary Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Name</label>
            <input
              value={form.primaryContactName}
              onChange={e => setForm(f => ({ ...f, primaryContactName: e.target.value }))}
              disabled={isPostLaunch}
              placeholder="Alice Smith"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={form.primaryContactEmail}
              onChange={e => setForm(f => ({ ...f, primaryContactEmail: e.target.value }))}
              disabled={isPostLaunch}
              placeholder="alice@example.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
            <p className="text-[11px] text-gray-600 mt-1">This address receives the launch invitation.</p>
          </div>
        </div>
      </div>

      {/* Plan + trial */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Plan &amp; Trial</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Plan</label>
            <select
              value={form.plan}
              onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
              disabled={isPostLaunch}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            >
              {PLAN_OPTIONS.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Est. Facilities</label>
            <input
              type="number"
              min={1}
              value={form.estimatedFacilities}
              onChange={e => setForm(f => ({ ...f, estimatedFacilities: e.target.value }))}
              disabled={isPostLaunch}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Trial Start Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={form.trialStartDate}
              onChange={e => setForm(f => ({ ...f, trialStartDate: e.target.value }))}
              disabled={isPostLaunch}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
            <p className="text-[11px] text-gray-600 mt-1">Required before launch.</p>
          </div>
        </div>
      </div>

      {/* Internal notes */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Internal Notes</label>
        <textarea
          value={form.internalNotes}
          onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))}
          disabled={isPostLaunch}
          rows={3}
          placeholder="Notes visible only to the HCE team…"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
      </div>

      {!isPostLaunch && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-400">
              <CheckCircle2 className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
      )}
    </div>
  )
}

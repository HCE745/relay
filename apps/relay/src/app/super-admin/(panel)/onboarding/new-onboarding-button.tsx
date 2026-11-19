"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Loader2, FlaskConical } from "lucide-react"

const PLAN_OPTIONS = [
  { value: "essentials",    label: "Essentials" },
  { value: "professional",  label: "Professional" },
  { value: "custom",        label: "Custom" },
]

export function NewOnboardingButton() {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [form, setForm] = useState({
    companyName:         "",
    primaryContactName:  "",
    primaryContactEmail: "",
    plan:                "essentials",
    estimatedFacilities: "1",
    internalNotes:       "",
    isTest:              false,
  })

  function update(k: keyof typeof form, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/super-admin/onboarding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          companyName:         form.companyName.trim(),
          primaryContactName:  form.primaryContactName.trim(),
          primaryContactEmail: form.primaryContactEmail.trim().toLowerCase(),
          plan:                form.plan,
          estimatedFacilities: parseInt(form.estimatedFacilities, 10) || 1,
          internalNotes:       form.internalNotes.trim() || undefined,
          isTest:              form.isTest || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? "Failed to create onboarding")
      }
      const { onboarding } = await res.json() as { onboarding: { id: string } }
      setOpen(false)
      router.push(`/super-admin/onboarding/${onboarding.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        New Onboarding
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                New Customer Onboarding
                {form.isTest && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700/60 tracking-wide">
                    TEST
                  </span>
                )}
              </h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Company Name *</label>
                <input
                  value={form.companyName}
                  onChange={e => update("companyName", e.target.value)}
                  placeholder="Acme Manufacturing"
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Contact Name *</label>
                  <input
                    value={form.primaryContactName}
                    onChange={e => update("primaryContactName", e.target.value)}
                    placeholder="Jane Smith"
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Contact Email *</label>
                  <input
                    type="email"
                    value={form.primaryContactEmail}
                    onChange={e => update("primaryContactEmail", e.target.value)}
                    placeholder={form.isTest ? "tester+test@example.com" : "jane@acme.com"}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Plan</label>
                  <select
                    value={form.plan}
                    onChange={e => update("plan", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {PLAN_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Est. Facilities</label>
                  <input
                    type="number"
                    min={1}
                    value={form.estimatedFacilities}
                    onChange={e => update("estimatedFacilities", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Internal Notes</label>
                <textarea
                  value={form.internalNotes}
                  onChange={e => update("internalNotes", e.target.value)}
                  placeholder="Referred by…, specific requirements…"
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Test org toggle */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="flex items-center pt-0.5">
                  <input
                    type="checkbox"
                    checked={form.isTest}
                    onChange={e => update("isTest", e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-gray-900"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-sm font-semibold text-amber-400">Test org</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Marks this org as a demo/test record. Email will be suppressed on launch — you will receive a secure invite URL instead.
                    Contact email must contain <code className="text-amber-500/80">+test</code>, end with{" "}
                    <code className="text-amber-500/80">@example.com</code>, or{" "}
                    <code className="text-amber-500/80">@relay-test.internal</code>.
                  </p>
                </div>
              </label>

              {error && (
                <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

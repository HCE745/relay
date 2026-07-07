"use client"

import { useState, useEffect } from "react"
import { Settings, Eye, EyeOff, Check, Loader2, AlertCircle, Info } from "lucide-react"

export default function SASettingsPage() {
  const [demoCode, setDemoCode]     = useState("")
  const [showCode, setShowCode]     = useState(false)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState("")

  useEffect(() => {
    fetch("/api/super-admin/settings")
      .then(r => r.json())
      .then(d => { setDemoCode(d.demoAccessCode ?? ""); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const res = await fetch("/api/super-admin/settings", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ demoAccessCode: demoCode }),
      })
      if (!res.ok) throw new Error("Save failed")
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError("Failed to save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Settings className="w-5 h-5 text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
        </div>
        <p className="text-gray-400 text-sm">Global configuration for the Relay platform.</p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Demo Access</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Control who can create demo sessions via <code className="text-indigo-400">/demo</code>.
          </p>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Access code
            </label>
            <div className="relative max-w-sm">
              <input
                type={showCode ? "text" : "password"}
                value={demoCode}
                onChange={e => setDemoCode(e.target.value)}
                placeholder={loading ? "Loading…" : "Enter access code (or leave blank for no gate)"}
                disabled={loading}
                className="w-full px-4 py-2.5 pr-10 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowCode(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                tabIndex={-1}
              >
                {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-3 flex items-start gap-2 text-xs text-gray-500">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p>
                When set, visitors to <code className="text-gray-400">/demo</code> must enter this
                code before a demo session is created. Leave blank to allow unrestricted access.
                Share this code with your sales team.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-green-400 text-sm">
                <Check className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

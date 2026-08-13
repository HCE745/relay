"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Save, Play } from "lucide-react"
import { useRouter } from "next/navigation"

interface Settings {
  id:                  string
  mode:                "manual" | "automatic"
  autoFrequency:       "weekly" | "biweekly" | "monthly"
  autoProviders:       string[]
  maxMonthlyBudgetUsd: number
  lastAutoRunAt:       string | null
}

export default function VisibilitySettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [running, setRunning]   = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/sales/visibility/settings")
      const data = await res.json() as { settings: Settings }
      setSettings(data.settings)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function save() {
    if (!settings) return
    setSaving(true); setError(""); setSaved(false)
    try {
      const res = await fetch("/api/sales/visibility/settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          mode:               settings.mode,
          autoFrequency:      settings.autoFrequency,
          autoProviders:      settings.autoProviders,
          maxMonthlyBudgetUsd: Number(settings.maxMonthlyBudgetUsd),
        }),
      })
      if (!res.ok) { setError("Save failed"); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function runNow() {
    setRunning(true); setError("")
    try {
      // Get all active prompts and run
      const promptsRes = await fetch("/api/sales/visibility/prompts")
      const promptsData = await promptsRes.json() as { prompts: { id: string; isActive: boolean }[] }
      const ids = (promptsData.prompts ?? []).filter(p => p.isActive).map(p => p.id)

      if (!ids.length) { setError("No active prompts found"); return }

      const res = await fetch("/api/sales/visibility/run", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ promptIds: ids, providers: settings?.autoProviders ?? ["anthropic"] }),
      })
      const data = await res.json() as { runId?: string; error?: string }
      if (!res.ok || !data.runId) { setError(data.error ?? "Run failed"); return }
      router.push(`/sales/marketing-intelligence/results/${data.runId}`)
    } finally {
      setRunning(false)
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(s => s ? { ...s, [key]: value } : s)
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center py-20">
      <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
    </div>
  )

  if (!settings) return null

  return (
    <div className="p-6 max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Visibility Settings</h1>
        <p className="text-gray-400 text-sm mt-0.5">Configure how and when visibility checks run</p>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-800 rounded-xl text-red-400 text-sm">{error}</div>}
      {saved && <div className="mb-4 px-4 py-3 bg-emerald-900/20 border border-emerald-800/60 rounded-xl text-emerald-400 text-sm">Settings saved.</div>}

      <div className="space-y-5">
        {/* Mode */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Run Mode</h2>
          <div className="flex gap-3">
            {(["manual", "automatic"] as const).map(m => (
              <button
                key={m}
                onClick={() => update("mode", m)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${
                  settings.mode === m
                    ? "bg-emerald-600/20 border-emerald-600 text-emerald-400"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                {m === "manual" ? "Manual" : "Automatic"}
                <span className="block text-[11px] font-normal mt-0.5 opacity-70">
                  {m === "manual" ? "Run when you click" : "Runs on a schedule"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Auto settings */}
        {settings.mode === "automatic" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300">Automatic Settings</h2>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Frequency</label>
              <select
                value={settings.autoFrequency}
                onChange={e => update("autoFrequency", e.target.value as "weekly" | "biweekly" | "monthly")}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Monthly Budget Cap (USD)</label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={settings.maxMonthlyBudgetUsd}
                  onChange={e => update("maxMonthlyBudgetUsd", Number(e.target.value))}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <p className="text-[11px] text-gray-600 mt-1">At $0.01/check, ${settings.maxMonthlyBudgetUsd} allows ~{Math.floor(Number(settings.maxMonthlyBudgetUsd) / 0.01)} checks/month</p>
            </div>

            {settings.lastAutoRunAt && (
              <p className="text-xs text-gray-500">
                Last auto run: {new Date(settings.lastAutoRunAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
        )}

        {/* Run now */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-1">Run Now</h2>
          <p className="text-xs text-gray-500 mb-3">Run all active prompts immediately regardless of mode.</p>
          <button
            onClick={() => void runNow()}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {running ? "Running…" : "Run All Active Prompts"}
          </button>
        </div>

        {/* Save */}
        <button
          onClick={() => void save()}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  )
}

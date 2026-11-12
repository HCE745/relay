"use client"

import { useState, useEffect } from "react"
import { Loader2, CheckCircle2, AlertCircle, Trash2, Save } from "lucide-react"

type ImapConfig = {
  id?: string
  host: string
  port: number
  emailAddress: string
  smtpHost: string
  smtpPort: number
}

const DEFAULTS: ImapConfig = {
  host: "",
  port: 993,
  emailAddress: "",
  smtpHost: "smtp.titan.email",
  smtpPort: 465,
}

export default function EmailSettingsPage() {
  const [config, setConfig]     = useState<ImapConfig>(DEFAULTS)
  const [password, setPassword] = useState("")
  const [exists, setExists]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/sales/imap-config")
        if (res.ok) {
          const data = await res.json()
          if (data) {
            setConfig({
              id:           data.id,
              host:         data.host         ?? "",
              port:         data.port         ?? 993,
              emailAddress: data.emailAddress ?? "",
              smtpHost:     data.smtpHost     ?? "smtp.titan.email",
              smtpPort:     data.smtpPort     ?? 465,
            })
            setExists(true)
          }
        }
      } catch {
        // no config yet
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        host:         config.host,
        port:         config.port,
        emailAddress: config.emailAddress,
        smtpHost:     config.smtpHost,
        smtpPort:     config.smtpPort,
      }
      if (password) body.password = password
      const res = await fetch("/api/sales/imap-config", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      setExists(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function deleteConfig() {
    if (!confirm("Remove IMAP configuration? This will disconnect your inbox.")) return
    setDeleting(true)
    try {
      await fetch("/api/sales/imap-config", { method: "DELETE" })
      setConfig(DEFAULTS)
      setPassword("")
      setExists(false)
    } catch {
      alert("Failed to delete config")
    } finally {
      setDeleting(false)
    }
  }

  function set<K extends keyof ImapConfig>(k: K, v: ImapConfig[K]) {
    setConfig(prev => ({ ...prev, [k]: v }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Email / IMAP</h1>
        <p className="text-gray-400 text-sm mt-0.5">Connect your inbox for outreach</p>
      </div>

      {/* Status badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-6 ${exists ? "bg-emerald-900/40 text-emerald-300" : "bg-gray-800 text-gray-400"}`}>
        {exists
          ? <><CheckCircle2 className="w-4 h-4" /> IMAP Connected</>
          : <><AlertCircle  className="w-4 h-4" /> Not configured</>
        }
      </div>

      <form onSubmit={save} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        {/* Email address */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email Address</label>
          <input
            type="email"
            value={config.emailAddress}
            onChange={e => set("emailAddress", e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Password {exists && <span className="text-gray-600">(leave blank to keep existing)</span>}
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={exists ? "••••••••" : "App password or SMTP password…"}
            required={!exists}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* IMAP host + port */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">IMAP Host</label>
            <input
              value={config.host}
              onChange={e => set("host", e.target.value)}
              placeholder="imap.titan.email"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">IMAP Port</label>
            <input
              type="number"
              value={config.port}
              onChange={e => set("port", Number(e.target.value))}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* SMTP host + port */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">SMTP Host</label>
            <input
              value={config.smtpHost}
              onChange={e => set("smtpHost", e.target.value)}
              placeholder="smtp.titan.email"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">SMTP Port</label>
            <input
              type="number"
              value={config.smtpPort}
              onChange={e => set("smtpPort", Number(e.target.value))}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {exists ? (
            <button
              type="button"
              onClick={deleteConfig}
              disabled={deleting}
              className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 disabled:text-gray-600 transition-colors"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Remove configuration
            </button>
          ) : <span />}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : saved
                ? <CheckCircle2 className="w-4 h-4" />
                : <Save className="w-4 h-4" />
            }
            {saved ? "Saved!" : "Save Configuration"}
          </button>
        </div>
      </form>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Loader2, CheckCircle2, AlertCircle, Trash2, Save } from "lucide-react"

type ImapConfig = {
  id?: string
  host: string
  port: number
  user: string
  secure: boolean
  fromName: string
  signature: string
}

const DEFAULTS: ImapConfig = {
  host: "",
  port: 993,
  user: "",
  secure: true,
  fromName: "",
  signature: "",
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
              id:        data.id,
              host:      data.host      ?? "",
              port:      data.port      ?? 993,
              user:      data.user      ?? "",
              secure:    data.secure    ?? true,
              fromName:  data.fromName  ?? "",
              signature: data.signature ?? "",
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
      const body: Record<string, unknown> = { ...config }
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
        {/* Host + port */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">IMAP Host</label>
            <input
              value={config.host}
              onChange={e => set("host", e.target.value)}
              placeholder="imap.gmail.com"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Port</label>
            <input
              type="number"
              value={config.port}
              onChange={e => set("port", Number(e.target.value))}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* User + password */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email / Username</label>
            <input
              value={config.user}
              onChange={e => set("user", e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Password {exists && <span className="text-gray-600">(leave blank to keep)</span>}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={exists ? "••••••••" : "App password…"}
              required={!exists}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Secure */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.secure}
            onChange={e => set("secure", e.target.checked)}
            className="w-4 h-4 accent-emerald-500"
          />
          <span className="text-sm text-gray-300">Use TLS/SSL (recommended)</span>
        </label>

        {/* From name */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">From Name</label>
          <input
            value={config.fromName}
            onChange={e => set("fromName", e.target.value)}
            placeholder="Your Name"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* Signature */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email Signature</label>
          <textarea
            value={config.signature}
            onChange={e => set("signature", e.target.value)}
            placeholder="Best,&#10;Your Name&#10;Your Title | Company"
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 resize-y"
          />
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

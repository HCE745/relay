"use client"

import { useState } from "react"
import { KeyRound, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react"

export function ChangePasswordForm() {
  const [current, setCurrent]   = useState("")
  const [next,    setNext]      = useState("")
  const [confirm, setConfirm]   = useState("")
  const [showPw,  setShowPw]    = useState(false)
  const [saving,  setSaving]    = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error,   setError]     = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setSuccess(false)
    if (next.length < 8) { setError("New password must be at least 8 characters"); return }
    if (next !== confirm) { setError("New passwords do not match"); return }

    setSaving(true)
    try {
      const res = await fetch("/api/sales/auth/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword: current, newPassword: next, confirmPassword: confirm }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? "Something went wrong"); return }
      setSuccess(true)
      setCurrent(""); setNext(""); setConfirm("")
    } catch {
      setError("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <KeyRound className="w-4.5 h-4.5 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-300">Change Password</h2>
      </div>

      {success && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-emerald-900/30 border border-emerald-800 rounded-lg text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Password updated successfully.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2.5 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={e => void handleSubmit(e)} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Current password</label>
          <input
            type={showPw ? "text" : "password"}
            value={current}
            onChange={e => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">New password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={next}
              onChange={e => setNext(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="w-full px-3 py-2 pr-9 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm new password</label>
          <input
            type={showPw ? "text" : "password"}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              confirm && confirm !== next ? "border-red-700" : "border-gray-700"
            }`}
          />
        </div>

        <div className="pt-1">
          <button
            type="submit"
            disabled={saving || !current || !next || next !== confirm}
            className="flex items-center gap-2 text-sm bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </div>
  )
}

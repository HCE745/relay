"use client"

import { useState } from "react"

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) {
      setMessage({ type: "err", text: "New passwords do not match" })
      return
    }
    if (next.length < 8) {
      setMessage({ type: "err", text: "Password must be at least 8 characters" })
      return
    }
    setSaving(true)
    setMessage(null)
    const res = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    setSaving(false)
    const data = await res.json()
    if (res.ok) {
      setMessage({ type: "ok", text: "Password changed successfully." })
      setCurrent(""); setNext(""); setConfirm("")
    } else {
      setMessage({ type: "err", text: data.error ?? "Failed to change password" })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {message && (
        <div className={`p-3 rounded-lg text-sm border ${message.type === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {message.text}
        </div>
      )}
      <input
        type="password"
        placeholder="Current password"
        value={current}
        onChange={e => setCurrent(e.target.value)}
        required
        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="password"
        placeholder="New password"
        value={next}
        onChange={e => setNext(e.target.value)}
        required
        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="password"
        placeholder="Confirm new password"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        required
        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
      >
        {saving ? "Saving…" : "Change Password"}
      </button>
    </form>
  )
}

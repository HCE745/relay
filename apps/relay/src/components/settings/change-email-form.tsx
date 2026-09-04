"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const router = useRouter()
  const [email, setEmail] = useState(currentEmail)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email === currentEmail) { setMessage({ type: "err", text: "That's already your current email." }); return }
    setLoading(true); setMessage(null)
    const res = await fetch("/api/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    const data = await res.json()
    if (res.ok) {
      setMessage({ type: "ok", text: "Email updated. Your session has been refreshed." })
      router.refresh()
    } else {
      setMessage({ type: "err", text: data.error ?? "Failed to update email" })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {message && (
        <div className={`p-2.5 rounded-lg text-sm border ${message.type === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {message.text}
        </div>
      )}
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={loading || !email || email === currentEmail}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Update Email"}
      </button>
    </form>
  )
}

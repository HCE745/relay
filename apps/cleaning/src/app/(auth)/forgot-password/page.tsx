"use client"

import { useState } from "react"
import Link from "next/link"
import { apiSend } from "@/lib/client"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    await apiSend("/api/auth/forgot", "POST", { email })
    setBusy(false)
    setSent(true) // always show success (no account enumeration)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Reset your password</h1>
        {sent ? (
          <div className="mt-4 space-y-4">
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              If an account exists for {email}, a reset link is on its way.
            </p>
            <Link href="/login" className="text-sm font-medium text-brand hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <p className="text-sm text-slate-500">Enter your email and we&apos;ll send a reset link.</p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <Link href="/login" className="block text-center text-sm text-slate-500 hover:text-brand">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </main>
  )
}

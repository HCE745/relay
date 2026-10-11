"use client"

import { useState } from "react"

// Typed-name e-signature accept/decline for a public proposal (Phase 27).
export function ProposalAccept({ token }: { token: string }) {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<"form" | "accepted" | "declined">("form")
  const [error, setError] = useState<string | null>(null)

  async function act(kind: "accept" | "decline") {
    setBusy(true); setError(null)
    const res = await fetch(`/api/public/proposal/${token}/${kind}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: kind === "accept" ? JSON.stringify({ signerName: name.trim() }) : undefined,
    })
    const data = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) return setError(data?.error ?? "Something went wrong. Please try again.")
    setState(kind === "accept" ? "accepted" : "declined")
  }

  if (state === "accepted") return <div className="rounded-xl bg-emerald-50 p-4 text-center text-sm text-emerald-800">Accepted — thank you! We&apos;ll be in touch to get started.</div>
  if (state === "declined") return <div className="rounded-xl bg-slate-100 p-4 text-center text-sm text-slate-600">You declined this proposal. Contact us if you have questions.</div>

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Type your full name to accept</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" placeholder="Your full name" />
      </label>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button onClick={() => act("accept")} disabled={busy || name.trim().length < 2} className="flex-1 rounded-xl bg-brand-700 py-3 text-base font-semibold text-white disabled:opacity-60">{busy ? "…" : "Accept & e-sign"}</button>
        <button onClick={() => act("decline")} disabled={busy} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600">Decline</button>
      </div>
      <p className="text-center text-xs text-slate-400">
        Typing your name and clicking Accept is a legally-binding electronic signature of intent (ESIGN/UETA). We record your name, the time, and your IP address.
      </p>
    </div>
  )
}

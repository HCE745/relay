"use client"

import { useEffect, useRef, useState } from "react"

type Msg = { id: string; sender: "STAFF" | "CUSTOMER"; body: string; createdAt: string }

// Two-way message thread (Phase 26). Used by staff (customer page) and the
// customer portal, pointed at their respective endpoints. `mine` is the sender
// type shown on the right.
export function MessageThread({ endpoint, mine }: { endpoint: string; mine: "STAFF" | "CUSTOMER" }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      const res = await fetch(endpoint)
      if (res.ok) setMsgs(await res.json())
    } catch { /* offline — leave as-is */ }
    setLoaded(true)
  }
  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }) }, [msgs.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setBusy(true)
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: text }) })
      if (res.ok) { setBody(""); await load() }
    } catch { /* */ }
    setBusy(false)
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-80 min-h-24 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
        {!loaded ? (
          <p className="text-center text-sm text-slate-400">Loading…</p>
        ) : msgs.length === 0 ? (
          <p className="text-center text-sm text-slate-400">No messages yet. Start the conversation below.</p>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className={`flex ${m.sender === mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.sender === mine ? "bg-brand-700 text-white" : "bg-white text-slate-800 ring-1 ring-slate-200"}`}>
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className={`mt-0.5 text-[10px] ${m.sender === mine ? "text-white/70" : "text-slate-400"}`}>{new Date(m.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type a message…" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand" />
        <button type="submit" disabled={busy || !body.trim()} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Send</button>
      </form>
    </div>
  )
}

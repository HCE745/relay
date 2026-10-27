"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type Hit = { sectionId: string; sopId: string; version: number; sopTitle: string; category: string; heading: string; snippet: string; applicable: boolean }

// Renders a snippet that Postgres marked with «…» around matches, as text (no
// HTML injection) with the matches emphasized.
function Snippet({ text }: { text: string }) {
  const parts = text.split(/«|»/)
  return <>{parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-900">{p}</mark> : <span key={i}>{p}</span>))}</>
}

// Section-level SOP search (Postgres full-text; no AI). `readerBase` is where a
// result deep-links (/sops for admin, /my-sops for the field app).
export function SopSearch({ readerBase, autoFocus }: { readerBase: string; autoFocus?: boolean }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])

  useEffect(() => {
    const term = q.trim()
    if (!term) { setHits([]); setLoading(false); return }
    setLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sops/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        const data = await res.json().catch(() => null)
        if (!ctrl.signal.aborted) setHits(Array.isArray(data?.data) ? data.data : [])
      } catch { /* aborted */ } finally { if (!ctrl.signal.aborted) setLoading(false) }
    }, 180)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q])

  function open(h: Hit) {
    router.push(`${readerBase}/${h.sopId}?q=${encodeURIComponent(q.trim())}#sec-${h.sectionId}`)
  }

  return (
    <div>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search procedures (e.g. chemical spill, floor buffer)…"
        aria-label="Search SOP sections"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
      />
      {q.trim() ? (
        <ul className="mt-3 space-y-2">
          {hits.length === 0 ? (
            <li className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">{loading ? "Searching…" : "No matching procedures"}</li>
          ) : hits.map((h) => (
            <li key={h.sectionId}>
              <button onClick={() => open(h)} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-brand hover:shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{h.sopTitle}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-sm text-slate-600">{h.heading}</span>
                  {h.applicable ? <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">Applies to you</span> : null}
                </div>
                <p className="mt-1 text-sm text-slate-500"><Snippet text={h.snippet} /></p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

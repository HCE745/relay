"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"

type Section = { id: string; heading: string; body: string }

// Highlight the search terms inside a section body (client-side, text-only — no
// HTML injection). Used when arriving from a search deep-link.
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig")
  return <>{text.split(re).map((part, i) => (re.test(part) ? <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-900">{part}</mark> : <span key={i}>{part}</span>))}</>
}

export function SopReader({ sections, q, sopId, canAck, alreadyAcked }: { sections: Section[]; q?: string; sopId?: string; canAck?: boolean; alreadyAcked?: boolean }) {
  const router = useRouter()
  const [active, setActive] = useState<string | null>(null)
  const [acked, setAcked] = useState(!!alreadyAcked)
  const [busy, setBusy] = useState(false)
  const terms = (q ?? "").trim().split(/\s+/).filter((t) => t.length > 1)

  // Deep-link: scroll the targeted section into view and ring it briefly.
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : ""
    const id = hash.startsWith("#sec-") ? hash.slice(5) : null
    if (!id) return
    setActive(id)
    const el = document.getElementById(`sec-${id}`)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
    const t = setTimeout(() => setActive(null), 2400)
    return () => clearTimeout(t)
  }, [])

  async function acknowledge() {
    if (!sopId) return
    setBusy(true)
    const res = await apiSend(`/api/sops/${sopId}/ack`, "POST")
    setBusy(false)
    if (res.ok) { setAcked(true); router.refresh() }
  }

  return (
    <div className="space-y-5">
      <ol className="space-y-4">
        {sections.map((s, i) => (
          <li key={s.id} id={`sec-${s.id}`} className={`rounded-xl border p-4 transition ${active === s.id ? "border-amber-300 ring-2 ring-amber-200" : "border-slate-200"}`}>
            <h3 className="mb-1.5 text-sm font-semibold text-slate-900"><span className="mr-2 text-slate-400">{i + 1}.</span>{s.heading}</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700"><Highlighted text={s.body} terms={active === s.id ? terms : []} /></p>
          </li>
        ))}
      </ol>
      {canAck ? (
        acked ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">You have acknowledged this procedure.</div>
        ) : (
          <button onClick={acknowledge} disabled={busy} className="w-full rounded-xl bg-brand-700 py-3 text-base font-semibold text-white disabled:opacity-60">
            {busy ? "Recording…" : "I have read and understood this procedure"}
          </button>
        )
      ) : null}
    </div>
  )
}

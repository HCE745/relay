"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

// Slide-over detail panels (Part 2). Driven by the URL (?peek=<type>&peekId=<id>)
// so a panel is linkable and the browser Back button closes it. PeekLink opens
// one by pushing those params; PeekHost (mounted once in the layout) reads them,
// fetches the essentials, and slides a panel in over the current screen.

type PeekData = { kind: string; title: string; subtitle?: string; href: string; fullLabel: string; fields: { label: string; value: string }[] }

export function PeekLink({ type, id, href, className, children }: { type: string; id: string; href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        // Let modified clicks (new tab) and middle-clicks navigate natively.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        router.push(`${pathname}?peek=${encodeURIComponent(type)}&peekId=${encodeURIComponent(id)}`)
      }}
    >
      {children}
    </a>
  )
}

export function PeekHost() {
  const router = useRouter()
  const sp = useSearchParams()
  const type = sp.get("peek")
  const id = sp.get("peekId")
  const openParam = !!(type && id)
  const [data, setData] = useState<PeekData | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const close = useCallback(() => { router.back() }, [router])

  useEffect(() => {
    if (!openParam) { setData(null); setNotFound(false); return }
    setLoading(true); setNotFound(false); setData(null)
    const ctrl = new AbortController()
    fetch(`/api/peek/${type}/${id}`, { signal: ctrl.signal })
      .then((r) => r.json()).catch(() => null)
      .then((j) => { if (ctrl.signal.aborted) return; if (j?.data) setData(j.data); else setNotFound(true) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [openParam, type, id])

  useEffect(() => {
    if (!openParam) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [openParam, close])

  if (!openParam) return null

  return (
    <div className="fixed inset-0 z-[9300]" role="dialog" aria-modal="true" aria-label={data ? `${data.kind} detail` : "Detail"}>
      <div className="absolute inset-0 bg-slate-900/40 cln-animate-overlay" onClick={close} />
      <div className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-lg cln-animate-panel sm:max-w-md">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{data?.kind ?? (loading ? "Loading" : "Detail")}</div>
            <div className="truncate text-sm font-semibold text-slate-900">{data?.title ?? (notFound ? "Not found" : " ")}</div>
          </div>
          <button onClick={close} aria-label="Close panel" className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => <div key={i} className="cln-skeleton h-10 w-full" />)}
            </div>
          ) : notFound ? (
            <p className="text-sm text-slate-500">This item is no longer available.</p>
          ) : data ? (
            <>
              {data.subtitle ? <p className="mb-3 text-sm text-slate-500">{data.subtitle}</p> : null}
              <dl className="divide-y divide-slate-100">
                {data.fields.map((f) => (
                  <div key={f.label} className="flex items-start justify-between gap-4 py-2.5">
                    <dt className="text-xs uppercase tracking-wide text-slate-400">{f.label}</dt>
                    <dd className="text-right text-sm text-slate-800">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
        </div>

        {data ? (
          <div className="border-t border-slate-100 px-5 py-3">
            <a href={data.href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">{data.fullLabel} →</a>
          </div>
        ) : null}
      </div>
    </div>
  )
}

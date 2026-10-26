"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

// Hand-rolled command palette (no library). Rationale: the behavior we need —
// Cmd/Ctrl+K, grouped results, keyboard nav, recents, debounced remote search —
// is ~200 lines and avoids a new client dependency and its bundle weight, which
// the brief asks us to minimize. Admin-only: this component is mounted in the
// admin layout, which cleaners never see.

type NavItem = { label: string; href: string }
type Result = { type: string; id: string; label: string; sublabel?: string; href: string }
type Item = { key: string; label: string; sublabel?: string; type: string; href: string }

const RECENT_KEY = "cln-palette-recent"
const titleize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

function readRecents(): Item[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") } catch { return [] }
}
function pushRecent(it: Item) {
  try {
    const next = [it, ...readRecents().filter((r) => r.href !== it.href)].slice(0, 6)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch { /* private mode */ }
}

export function CommandPalette({ nav }: { nav: NavItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const [recents, setRecents] = useState<Item[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Quick actions, scoped by reachability: derived from the already role- and
  // capability-filtered nav, so we never offer an action for an unreachable screen.
  const has = useCallback((href: string) => nav.some((n) => n.href === href), [nav])
  const quickActions: Item[] = useMemo(() => {
    const qa: Item[] = []
    const add = (href: string, label: string) => { if (has(href)) qa.push({ key: `qa:${href}`, label, type: "Action", href }) }
    add("/customers", "New customer")
    add("/jobs", "New job")
    add("/billing/invoices", "New invoice")
    add("/work-orders", "New work order")
    add("/inspections", "Run inspection")
    add("/schedule", "Go to today's schedule")
    return qa
  }, [has])

  const navItems: Item[] = useMemo(() => nav.map((n) => ({ key: `nav:${n.href}`, label: n.label, type: "Go to", href: n.href })), [nav])

  // Cmd/Ctrl+K toggles; Escape closes (handled in the dialog too).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o) }
    }
    const onOpen = () => setOpen(true)
    document.addEventListener("keydown", onKey)
    window.addEventListener("cln:open-palette", onOpen)
    return () => { document.removeEventListener("keydown", onKey); window.removeEventListener("cln:open-palette", onOpen) }
  }, [])

  // On open: focus the input, reset, load recents.
  useEffect(() => {
    if (!open) return
    setQuery(""); setResults([]); setActive(0); setRecents(readRecents())
    const t = setTimeout(() => inputRef.current?.focus(), 20)
    return () => clearTimeout(t)
  }, [open])

  // Debounced remote search (200ms). Previous results stay visible while a new
  // query is in flight, so a slow query never blanks the list.
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) { setResults([]); setLoading(false); return }
    setLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        const data = await res.json().catch(() => null)
        if (!ctrl.signal.aborted) setResults(Array.isArray(data?.data) ? data.data : [])
      } catch { /* aborted */ } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 200)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [query, open])

  // The flat, ordered list of visible items (what arrows move through).
  const items: { heading: string; items: Item[] }[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return [
        ...(recents.length ? [{ heading: "Recent", items: recents }] : []),
        ...(quickActions.length ? [{ heading: "Quick actions", items: quickActions }] : []),
        { heading: "Go to", items: navItems },
      ]
    }
    const match = (s: string) => s.toLowerCase().includes(q)
    const resItems: Item[] = results.map((r) => ({ key: `${r.type}:${r.id}`, label: r.label, sublabel: r.sublabel, type: r.type, href: r.href }))
    return [
      ...(resItems.length ? [{ heading: "Results", items: resItems }] : []),
      ...(() => { const m = quickActions.filter((a) => match(a.label)); return m.length ? [{ heading: "Quick actions", items: m }] : [] })(),
      ...(() => { const m = navItems.filter((n) => match(n.label)); return m.length ? [{ heading: "Go to", items: m }] : [] })(),
    ]
  }, [query, results, recents, quickActions, navItems])

  const flat = useMemo(() => items.flatMap((g) => g.items), [items])
  useEffect(() => { setActive((a) => Math.min(a, Math.max(0, flat.length - 1))) }, [flat.length])

  const choose = useCallback((it: Item | undefined) => {
    if (!it) return
    if (it.type !== "Action" && it.type !== "Go to") pushRecent(it)
    setOpen(false)
    router.push(it.href)
  }, [router])

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === "Enter") { e.preventDefault(); choose(flat[active]) }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false) }
  }

  if (!open) return null

  let idx = -1
  return (
    <div className="fixed inset-0 z-[9500] cln-animate-overlay" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={() => setOpen(false)}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div className="relative mx-auto mt-[12vh] w-[92vw] max-w-xl cln-animate-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={onInputKey}
            placeholder="Search or jump to…"
            aria-label="Search customers, jobs, invoices, issues, and screens"
            aria-expanded="true"
            role="combobox"
            aria-controls="cln-palette-list"
            className="w-full border-b border-slate-100 px-4 py-3.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          <ul id="cln-palette-list" role="listbox" className="max-h-[52vh] overflow-y-auto py-1.5">
            {flat.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-slate-400">{loading ? "Searching…" : query.trim() ? "No matches" : "Type to search"}</li>
            ) : items.map((group) => (
              <li key={group.heading}>
                <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.heading}</div>
                <ul>
                  {group.items.map((it) => {
                    idx++
                    const isActive = idx === active
                    const myIdx = idx
                    return (
                      <li
                        key={it.key}
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setActive(myIdx)}
                        onMouseDown={(e) => { e.preventDefault(); choose(it) }}
                        className={`mx-1.5 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm ${isActive ? "bg-brand-50 text-brand-900" : "text-slate-700"}`}
                      >
                        <span className="truncate">{it.label}{it.sublabel ? <span className="ml-2 text-xs text-slate-400">{it.sublabel}</span> : null}</span>
                        <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-400">{it.type === "Go to" || it.type === "Action" ? it.type : titleize(it.type)}</span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
            <span>↑↓ move · ↵ open · esc close</span>
            {loading ? <span>searching…</span> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

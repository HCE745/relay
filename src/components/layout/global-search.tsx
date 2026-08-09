"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, AlertCircle, Package, Wrench, BookOpen, X } from "lucide-react"

interface SearchResult {
  id: string
  title: string
  subtitle: string
  href: string
}

interface SearchResults {
  issues: SearchResult[]
  assets: SearchResult[]
  vendors: SearchResult[]
  sops: SearchResult[]
}

const SECTIONS: Array<{ key: keyof SearchResults; label: string; icon: React.ElementType }> = [
  { key: "issues",  label: "Issues",  icon: AlertCircle },
  { key: "assets",  label: "Assets",  icon: Package },
  { key: "vendors", label: "Vendors", icon: Wrench },
  { key: "sops",    label: "SOPs",    icon: BookOpen },
]

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [nlFilters, setNlFilters] = useState<{ status?: string; category?: string; priority?: string; summary?: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openSearch = useCallback(() => {
    setOpen(true)
    setQuery("")
    setResults(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setQuery("")
    setResults(null)
    setActiveIdx(0)
    setNlFilters(null)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        if (open) close(); else openSearch()
      }
      if (e.key === "/" && !open && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault()
        openSearch()
      }
      if (e.key === "Escape" && open) close()
    }
    function onCustom() { openSearch() }
    window.addEventListener("keydown", onKey)
    window.addEventListener("relay:open-search", onCustom)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("relay:open-search", onCustom)
    }
  }, [open, openSearch, close])

  const NL_PATTERN = /^(show me|find|which|how many|when was|what are|list all|give me)\b/i

  useEffect(() => {
    if (!query.trim()) { setResults(null); setNlFilters(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        if (NL_PATTERN.test(query.trim())) {
          // Natural language mode
          const nlRes = await fetch("/api/search/nl", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          })
          if (nlRes.ok) {
            const { filters } = await nlRes.json() as { filters: { status?: string; category?: string; priority?: string; summary?: string } }
            setNlFilters(filters)
            const params = new URLSearchParams({ q: filters.summary ?? query })
            if (filters.status)   params.set("status",   filters.status)
            if (filters.category) params.set("category", filters.category)
            if (filters.priority) params.set("priority", filters.priority)
            const res = await fetch(`/api/search?${params}`)
            if (res.ok) setResults(await res.json())
          }
        } else {
          setNlFilters(null)
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
          if (res.ok) setResults(await res.json())
        }
      } finally {
        setLoading(false)
      }
    }, 350)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const allResults = results
    ? SECTIONS.flatMap(s => results[s.key].map(r => ({ ...r, section: s.label })))
    : []

  function navigate(href: string) {
    close()
    router.push(href)
  }

  useEffect(() => { setActiveIdx(0) }, [allResults.length])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, allResults.length - 1)) }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === "Enter" && allResults[activeIdx]) navigate(allResults[activeIdx].href)
  }

  if (!open) return null

  let globalIdx = 0

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4" onClick={close}>
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search issues, assets, vendors, SOPs…"
            className="flex-1 text-sm outline-none text-gray-900 placeholder-gray-400"
          />
          {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />}
          <button onClick={close} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* NL filter chips */}
        {nlFilters && (
          <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Filtered by</span>
            {nlFilters.status   && <span className="text-[10px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{nlFilters.status}</span>}
            {nlFilters.category && <span className="text-[10px] font-medium bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{nlFilters.category.replace(/_/g, " ")}</span>}
            {nlFilters.priority && <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{nlFilters.priority}</span>}
          </div>
        )}

        {/* Results */}
        {results && allResults.length === 0 && !loading && (
          <p className="text-center text-sm text-gray-400 py-8">No results for &ldquo;{query}&rdquo;</p>
        )}

        {results && allResults.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {SECTIONS.map(({ key, label, icon: Icon }) => {
              const items = results[key]
              if (!items.length) return null
              return (
                <div key={key} className="mb-1">
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <Icon className="w-3 h-3 text-gray-400" />
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
                  </div>
                  {items.map(item => {
                    const idx = globalIdx++
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate(item.href)}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${activeIdx === idx ? "bg-blue-50" : "hover:bg-gray-50"}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${activeIdx === idx ? "text-blue-700" : "text-gray-900"}`}>{item.title}</p>
                          <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {!results && !loading && (
          <div className="px-4 py-5 text-xs text-gray-400 text-center">
            Type to search across issues, assets, vendors, and SOPs
          </div>
        )}

        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-[11px] text-gray-400">
          <span><kbd className="bg-gray-100 rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="bg-gray-100 rounded px-1">↵</kbd> open</span>
          <span><kbd className="bg-gray-100 rounded px-1">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

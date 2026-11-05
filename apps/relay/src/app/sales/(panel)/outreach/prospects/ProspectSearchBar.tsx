"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useTransition, useState } from "react"
import { Search, X, SlidersHorizontal } from "lucide-react"

interface Props {
  initialSearch: string
  currentStatus: string
  currentSort:   string
  statusOptions: [string, string][]
  sortOptions:   { value: string; label: string }[]
}

export function ProspectSearchBar({
  initialSearch,
  currentStatus,
  currentSort,
  statusOptions,
  sortOptions,
}: Props) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [localSearch, setLocalSearch] = useState(initialSearch)

  const navigate = useCallback((overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(overrides)) {
      if (v) sp.set(k, v); else sp.delete(k)
    }
    sp.delete("page") // reset to page 1 on any filter change
    startTransition(() => { router.push(`${pathname}?${sp.toString()}`) })
  }, [pathname, router, searchParams])

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate({ q: localSearch || undefined })
  }

  function clearSearch() {
    setLocalSearch("")
    navigate({ q: undefined })
  }

  const hasFilters = currentStatus || localSearch

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <form onSubmit={onSearchSubmit} className="flex items-center gap-2 flex-1 min-w-48">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            placeholder="Search company, industry, city…"
            className="w-full pl-9 pr-8 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {localSearch && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          Search
        </button>
      </form>

      {/* Status filter */}
      <div className="flex items-center gap-1.5">
        <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <select
          value={currentStatus}
          onChange={e => navigate({ status: e.target.value || undefined })}
          className="bg-gray-900 border border-gray-800 text-sm text-gray-300 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Statuses</option>
          {statusOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Sort */}
      <select
        value={currentSort}
        onChange={e => navigate({ sort: e.target.value !== "fit_desc" ? e.target.value : undefined })}
        className="bg-gray-900 border border-gray-800 text-sm text-gray-300 rounded-lg px-2.5 py-2 focus:outline-none focus:border-emerald-500"
      >
        {sortOptions.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Clear all */}
      {hasFilters && (
        <button
          onClick={() => { setLocalSearch(""); navigate({ q: undefined, status: undefined, sort: undefined }) }}
          className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors whitespace-nowrap"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

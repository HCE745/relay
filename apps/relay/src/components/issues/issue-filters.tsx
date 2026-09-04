"use client"

import { useRouter, usePathname } from "next/navigation"
import { ISSUE_STATUS, ISSUE_PRIORITY, ISSUE_CATEGORY } from "@/lib/constants"
import { Search } from "lucide-react"
import { useState, useTransition } from "react"

interface Location {
  id:   string
  name: string
}

interface IssueFiltersProps {
  initialFilters: {
    status?:      string
    priority?:    string
    category?:    string
    search?:      string
    locationId?:  string
    isEscalated?: string
  }
  locations?: Location[]
}

export function IssueFilters({ initialFilters, locations = [] }: IssueFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(initialFilters.search ?? "")

  function buildParams(overrides: Record<string, string | undefined>) {
    const base: Record<string, string | undefined> = {
      status:      initialFilters.status,
      priority:    initialFilters.priority,
      category:    initialFilters.category,
      search:      search || undefined,
      locationId:  initialFilters.locationId,
      isEscalated: initialFilters.isEscalated,
    }
    const merged = { ...base, ...overrides }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v)
    }
    return params
  }

  function updateFilter(key: string, value: string) {
    const params = buildParams({ [key]: value || undefined })
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = buildParams({ search: search || undefined })
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <div className="flex flex-wrap gap-3">
      <form onSubmit={handleSearch} className="relative flex-1 min-w-48 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search issues…"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </form>

      <select
        value={initialFilters.status ?? ""}
        onChange={(e) => updateFilter("status", e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">All Statuses</option>
        {Object.entries(ISSUE_STATUS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      <select
        value={initialFilters.priority ?? ""}
        onChange={(e) => updateFilter("priority", e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">All Priorities</option>
        {Object.entries(ISSUE_PRIORITY).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      <select
        value={initialFilters.category ?? ""}
        onChange={(e) => updateFilter("category", e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">All Categories</option>
        {Object.entries(ISSUE_CATEGORY).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {locations.length > 0 && (
        <select
          value={initialFilters.locationId ?? ""}
          onChange={(e) => updateFilter("locationId", e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Locations</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      )}

      <select
        value={initialFilters.isEscalated ?? ""}
        onChange={(e) => updateFilter("isEscalated", e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">All Issues</option>
        <option value="true">Escalated only</option>
      </select>
    </div>
  )
}

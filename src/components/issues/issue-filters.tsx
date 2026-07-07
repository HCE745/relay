"use client"

import { useRouter, usePathname } from "next/navigation"
import { ISSUE_STATUS, ISSUE_PRIORITY, ISSUE_CATEGORY } from "@/lib/constants"
import { Search } from "lucide-react"
import { useState, useTransition } from "react"

interface IssueFiltersProps {
  initialFilters: {
    status?: string
    priority?: string
    category?: string
    search?: string
  }
}

export function IssueFilters({ initialFilters }: IssueFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(initialFilters.search ?? "")

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams()
    if (initialFilters.status) params.set("status", initialFilters.status)
    if (initialFilters.priority) params.set("priority", initialFilters.priority)
    if (initialFilters.category) params.set("category", initialFilters.category)
    if (search) params.set("search", search)
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (initialFilters.status) params.set("status", initialFilters.status)
    if (initialFilters.priority) params.set("priority", initialFilters.priority)
    if (initialFilters.category) params.set("category", initialFilters.category)
    if (search) params.set("search", search)
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
    </div>
  )
}

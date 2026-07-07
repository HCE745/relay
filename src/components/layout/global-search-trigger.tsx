"use client"

import { Search } from "lucide-react"

export function GlobalSearchTrigger() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("relay:open-search"))}
      className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      aria-label="Search"
    >
      <Search className="w-3.5 h-3.5" />
      <span>Search…</span>
      <kbd className="hidden lg:inline text-xs bg-white border border-gray-200 rounded px-1">⌘K</kbd>
    </button>
  )
}

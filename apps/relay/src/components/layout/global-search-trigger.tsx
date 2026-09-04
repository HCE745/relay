"use client"

import { Search } from "lucide-react"

export function GlobalSearchTrigger() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("relay:open-search"))}
      className="hidden md:flex items-center gap-2.5 px-3.5 py-2 min-w-[220px] text-sm text-gray-400 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg shadow-sm transition-colors"
      aria-label="Search"
    >
      <Search className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="hidden lg:inline text-[11px] bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-gray-400 font-medium">⌘K</kbd>
    </button>
  )
}

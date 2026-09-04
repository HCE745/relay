"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Bookmark, BookmarkCheck, X, Plus } from "lucide-react"

interface SavedView {
  id: string
  name: string
  filters: Record<string, string>
}

const STORAGE_KEY = "relay-saved-issue-views"

interface Props {
  currentFilters: Record<string, string>
}

export function SavedViews({ currentFilters }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [views, setViews] = useState<SavedView[]>([])
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState("")

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setViews(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  function persist(next: SavedView[]) {
    setViews(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function applyView(v: SavedView) {
    const params = new URLSearchParams(v.filters)
    router.push(`${pathname}?${params.toString()}`)
  }

  function deleteView(id: string) {
    persist(views.filter(v => v.id !== id))
  }

  function saveCurrentView() {
    if (!saveName.trim()) return
    const hasFilters = Object.values(currentFilters).some(v => v)
    if (!hasFilters) return
    const newView: SavedView = {
      id: crypto.randomUUID(),
      name: saveName.trim(),
      filters: { ...currentFilters },
    }
    persist([...views, newView])
    setSaveName("")
    setSaving(false)
  }

  const hasFilters = Object.values(currentFilters).some(v => v)

  if (!views.length && !hasFilters) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <Bookmark className="w-3.5 h-3.5 text-gray-400 shrink-0" />

      {views.map(v => (
        <div key={v.id} className="flex items-center gap-0.5">
          <button
            onClick={() => applyView(v)}
            className="text-xs px-2.5 py-1 rounded-l-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
          >
            {v.name}
          </button>
          <button
            onClick={() => deleteView(v.id)}
            className="text-xs px-1.5 py-1 rounded-r-lg border border-l-0 border-gray-200 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
            title="Remove saved view"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      {hasFilters && (
        saving ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveCurrentView(); if (e.key === "Escape") setSaving(false) }}
              placeholder="View name…"
              className="text-xs px-2.5 py-1 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
            />
            <button
              onClick={saveCurrentView}
              className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save
            </button>
            <button onClick={() => setSaving(false)} className="text-xs text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSaving(true)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            Save view
          </button>
        )
      )}
    </div>
  )
}

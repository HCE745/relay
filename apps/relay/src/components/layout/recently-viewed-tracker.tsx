"use client"

import { useEffect } from "react"

export type RecentlyViewedItem = {
  id: string
  title: string
  type: "issue" | "asset"
  status: string
  href: string
}

const KEY = "relay:recentlyViewed"

export function RecentlyViewedTracker({ item }: { item: RecentlyViewedItem }) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      const existing: RecentlyViewedItem[] = raw ? JSON.parse(raw) : []
      const deduped = existing.filter(i => i.id !== item.id)
      localStorage.setItem(KEY, JSON.stringify([item, ...deduped].slice(0, 4)))
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

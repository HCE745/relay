"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Plus, Megaphone, CheckCircle2, AlertCircle, Search } from "lucide-react"

const PRIORITY_LABEL: Record<string, { label: string; cls: string }> = {
  normal:    { label: "Normal",    cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  urgent:    { label: "Urgent",    cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  emergency: { label: "Emergency", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
}

interface Announcement {
  id:                     string
  title:                  string
  body:                   string
  priority:               string
  createdAt:              Date | string
  requiresAcknowledgment: boolean
  createdBy:              { id: string; name: string }
  acknowledgments:        { userId: string }[]
  _count:                 { acknowledgments: number }
}

interface Props {
  announcements: Announcement[]
  canCreate:     boolean
  wcSearch?:     boolean
}

export function AnnouncementsListClient({ announcements, canCreate, wcSearch = true }: Props) {
  const [query, setQuery] = useState("")

  const filtered = announcements.filter(a =>
    !query ||
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.body.toLowerCase().includes(query.toLowerCase()) ||
    a.createdBy.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Announcements</h1>
        {canCreate && (
          <Link
            href="/communications/announcements/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New
          </Link>
        )}
      </div>

      {wcSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search announcements..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{query ? "No matching announcements" : "No announcements"}</p>
        </div>
      ) : (
        <div className="space-y-3" data-tour="announcements-list">
          {filtered.map(a => {
            const acked    = a.acknowledgments.length > 0
            const priority = PRIORITY_LABEL[a.priority] ?? PRIORITY_LABEL.normal
            return (
              <Link
                key={a.id}
                href={`/communications/announcements/${a.id}`}
                className={cn(
                  "block bg-white dark:bg-gray-800 border rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors",
                  acked ? "border-gray-100 dark:border-gray-700" : "border-blue-200 dark:border-blue-700"
                )}
              >
                <div className="flex items-start gap-3">
                  {acked
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    : <AlertCircle  className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        "font-semibold text-sm",
                        acked ? "text-gray-700 dark:text-gray-300" : "text-gray-900 dark:text-white"
                      )}>
                        {a.title}
                      </span>
                      <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", priority.cls)}>
                        {priority.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                      <span>{a.createdBy.name}</span>
                      <span>·</span>
                      <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                      {a.requiresAcknowledgment && (
                        <>
                          <span>·</span>
                          <span>{a._count.acknowledgments} ack&apos;d</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

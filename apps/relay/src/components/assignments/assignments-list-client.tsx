"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ClipboardCheck, AlertTriangle, Clock, CheckCircle2, Search } from "lucide-react"

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low:      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

const STATUS_COLOR: Record<string, string> = {
  pending:      "text-gray-500 dark:text-gray-400",
  acknowledged: "text-blue-600 dark:text-blue-400",
  in_progress:  "text-yellow-600 dark:text-yellow-400",
  completed:    "text-green-600 dark:text-green-400",
  cancelled:    "text-gray-400 dark:text-gray-600",
}

const STATUS_ICON: Record<string, React.ElementType> = {
  pending:      Clock,
  acknowledged: ClipboardCheck,
  in_progress:  AlertTriangle,
  completed:    CheckCircle2,
  cancelled:    Clock,
}

function formatDate(d: Date | string | null) {
  if (!d) return null
  const date = new Date(d)
  const now  = new Date()
  const diff = date.getTime() - now.getTime()
  const days = Math.round(diff / 86400000)
  if (days < 0)   return { label: `${Math.abs(days)}d overdue`, overdue: true }
  if (days === 0) return { label: "Due today", overdue: false }
  if (days === 1) return { label: "Due tomorrow", overdue: false }
  return { label: `Due ${date.toLocaleDateString()}`, overdue: false }
}

interface Assignment {
  id:       string
  title:    string
  status:   string
  priority: string
  dueDate:  Date | string | null
  assignee:   { id: string; name: string }
  assignedBy: { id: string; name: string }
  linkedIssue: { id: string; title: string } | null
  linkedAsset: { id: string; name: string } | null
  _count:  { comments: number }
}

interface Props {
  assignments: Assignment[]
  canCreate:   boolean
}

export function AssignmentsListClient({ assignments, canCreate }: Props) {
  const [query, setQuery] = useState("")

  const filtered = assignments.filter(a =>
    !query ||
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.assignee.name.toLowerCase().includes(query.toLowerCase()) ||
    (a.linkedIssue?.title.toLowerCase().includes(query.toLowerCase()) ?? false) ||
    (a.linkedAsset?.name.toLowerCase().includes(query.toLowerCase()) ?? false)
  )

  const open      = filtered.filter(a => !["completed", "cancelled"].includes(a.status))
  const completed = filtered.filter(a => a.status === "completed")

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by title, assignee, or linked issue..."
          className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{query ? "No matching assignments" : "No assignments found"}</p>
          {canCreate && !query && (
            <Link href="/assignments/new" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
              Create the first one
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2" data-tour="assignment-list">
          {[...open, ...completed].map(a => {
            const StatusIcon = STATUS_ICON[a.status] ?? Clock
            const due = formatDate(a.dueDate)
            return (
              <Link
                key={a.id}
                href={`/assignments/${a.id}`}
                className="block bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <StatusIcon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", STATUS_COLOR[a.status])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {a.title}
                      </span>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0", PRIORITY_COLOR[a.priority])}>
                        {a.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                      <span>{a.assignee.name}</span>
                      {due && (
                        <span className={due.overdue ? "text-red-500 font-medium" : ""}>{due.label}</span>
                      )}
                      {a.linkedIssue && <span>Issue: {a.linkedIssue.title}</span>}
                      {a.linkedAsset && <span>Asset: {a.linkedAsset.name}</span>}
                      {a._count.comments > 0 && (
                        <span>{a._count.comments} comment{a._count.comments !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 capitalize">{a.status.replace("_", " ")}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

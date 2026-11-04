"use client"

import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { SUGGESTION_CATEGORY_LABEL, SUGGESTION_TYPE_LABEL } from "@/lib/suggestion-constants"

interface SubmittedSuggestion {
  id: string
  type: string
  content: string
  status: string
  adminNote: string | null
  detectedCategory: string | null
  createdAt: string
  routedToUser: { name: string } | null
  convertedToIssue: { id: string; title: string } | null
}

const STATUS_STYLE: Record<string, string> = {
  PENDING:     "bg-yellow-100 text-yellow-800",
  REVIEWED:    "bg-green-100 text-green-800",
  DISMISSED:   "bg-gray-100 text-gray-500",
  CONVERTED:   "bg-blue-100 text-blue-800",
  IMPLEMENTED: "bg-emerald-100 text-emerald-800",
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:     "Pending Review",
  REVIEWED:    "Reviewed",
  DISMISSED:   "Dismissed",
  CONVERTED:   "Converted to Issue",
  IMPLEMENTED: "Implemented",
}

export function MySubmittedSuggestions({ suggestions }: { suggestions: SubmittedSuggestion[] }) {
  return (
    <div className="space-y-3">
      {suggestions.map(s => (
        <div key={s.id} className="border border-gray-100 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
                {s.type && SUGGESTION_TYPE_LABEL[s.type as keyof typeof SUGGESTION_TYPE_LABEL] && (
                  <span className="text-xs text-gray-400">
                    {SUGGESTION_TYPE_LABEL[s.type as keyof typeof SUGGESTION_TYPE_LABEL]}
                  </span>
                )}
                {s.detectedCategory && SUGGESTION_CATEGORY_LABEL[s.detectedCategory as keyof typeof SUGGESTION_CATEGORY_LABEL] && (
                  <span className="text-xs text-gray-400">
                    {SUGGESTION_CATEGORY_LABEL[s.detectedCategory as keyof typeof SUGGESTION_CATEGORY_LABEL]}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-800 line-clamp-2">{s.content}</p>
              <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                {s.routedToUser && (
                  <p className="text-xs text-gray-500">Routed to {s.routedToUser.name}</p>
                )}
                {s.adminNote && (
                  <p className="text-xs text-gray-600 italic bg-gray-50 px-2 py-0.5 rounded">
                    Note: {s.adminNote}
                  </p>
                )}
                {s.convertedToIssue && (
                  <Link
                    href={`/issues/${s.convertedToIssue.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    → Converted: {s.convertedToIssue.title}
                  </Link>
                )}
              </div>
            </div>
            <span className="text-xs text-gray-400 shrink-0">
              {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

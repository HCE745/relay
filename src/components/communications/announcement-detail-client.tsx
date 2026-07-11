"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, AlertCircle, Users } from "lucide-react"

interface User { id: string; name: string; role?: string }
interface Ack  { userId: string; acknowledgedAt: Date | string; user: User }

interface Announcement {
  id: string; title: string; body: string
  priority: string; scopeType: string
  requiresAcknowledgment: boolean
  createdAt: Date | string; expiresAt?: Date | string | null
  createdBy: User
  acknowledgments: Ack[]
}

const PRIORITY_CLS: Record<string, string> = {
  normal:    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  urgent:    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  emergency: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

export function AnnouncementDetailClient({
  announcement,
  userAcked,
  isManager,
}: {
  announcement: Announcement
  userAcked: boolean
  isManager: boolean
}) {
  const [acked, setAcked]     = useState(userAcked)
  const [acking, setAcking]   = useState(false)
  const [ackList, setAckList] = useState(announcement.acknowledgments)

  async function acknowledge() {
    if (acked || acking) return
    setAcking(true)
    try {
      const res = await fetch(`/api/announcements/${announcement.id}/acknowledge`, { method: "POST" })
      if (res.ok) setAcked(true)
    } finally {
      setAcking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-start gap-3 mb-4">
          {acked
            ? <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
            : <AlertCircle  className="w-6 h-6 text-blue-500 flex-shrink-0" />
          }
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{announcement.title}</h1>
              <span className={cn("px-2 py-0.5 rounded text-xs font-medium", PRIORITY_CLS[announcement.priority] ?? PRIORITY_CLS.normal)}>
                {announcement.priority}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <span>By {announcement.createdBy.name}</span>
              <span>·</span>
              <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
              {announcement.expiresAt && (
                <>
                  <span>·</span>
                  <span>Expires {new Date(announcement.expiresAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
          {announcement.body}
        </p>

        {announcement.requiresAcknowledgment && !acked && (
          <button
            onClick={acknowledge} disabled={acking}
            className="mt-5 w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {acking ? "Acknowledging..." : "Acknowledge"}
          </button>
        )}
        {acked && (
          <div className="mt-5 flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            You acknowledged this announcement
          </div>
        )}
      </div>

      {isManager && announcement.requiresAcknowledgment && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Acknowledged by ({ackList.length})
            </h2>
          </div>
          {ackList.length === 0 ? (
            <p className="text-sm text-gray-400">No one has acknowledged yet.</p>
          ) : (
            <div className="space-y-2">
              {ackList.map(a => (
                <div key={a.userId} className="flex items-center justify-between text-sm">
                  <span className="text-gray-900 dark:text-white">{a.user.name}</span>
                  <span className="text-gray-400">{new Date(a.acknowledgedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

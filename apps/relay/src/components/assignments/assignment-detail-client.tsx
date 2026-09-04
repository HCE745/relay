"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Clock, CheckCircle2, AlertTriangle, ClipboardCheck, XCircle,
  ExternalLink, MessageSquare, Send, Lock
} from "lucide-react"

type Status   = "pending" | "acknowledged" | "in_progress" | "completed" | "cancelled"
type Priority = "low" | "medium" | "high" | "critical"

interface User    { id: string; name: string; role?: string }
interface Comment { id: string; content: string; photoUrl?: string | null; createdAt: Date | string; author: User }
interface StatusEntry { id: string; fromStatus?: string | null; toStatus: string; note?: string | null; createdAt: Date | string; changedBy: User }

interface Assignment {
  id: string; title: string; description?: string | null; status: Status; priority: Priority
  notes?: string | null; dueDate?: Date | null; completedAt?: Date | null; createdAt: Date | string
  assignee: User; assignedBy: User
  linkedIssue?:  { id: string; title: string; status: string } | null
  linkedAsset?:  { id: string; name: string } | null
  linkedVendor?: { id: string; name: string } | null
  linkedSop?:    { id: string; title: string } | null
  comments:      Comment[]
  statusHistory: StatusEntry[]
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low:      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

const STATUS_TRANSITIONS: Record<Status, Status[]> = {
  pending:      ["acknowledged", "in_progress", "cancelled"],
  acknowledged: ["in_progress", "cancelled"],
  in_progress:  ["completed", "cancelled"],
  completed:    [],
  cancelled:    [],
}

const STATUS_ICON: Record<Status, React.ElementType> = {
  pending:      Clock,
  acknowledged: ClipboardCheck,
  in_progress:  AlertTriangle,
  completed:    CheckCircle2,
  cancelled:    XCircle,
}

const STATUS_COLOR: Record<Status, string> = {
  pending:      "text-gray-500",
  acknowledged: "text-blue-600 dark:text-blue-400",
  in_progress:  "text-yellow-600 dark:text-yellow-400",
  completed:    "text-green-600 dark:text-green-400",
  cancelled:    "text-gray-400",
}

function formatTs(d: Date | string) {
  return new Date(d).toLocaleString()
}

function LockedFeature({ feature, plan }: { feature: string; plan: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-3 text-sm text-gray-500">
      <Lock className="w-4 h-4 flex-shrink-0" />
      <span>{feature} requires the <Link href="/settings/billing" className="text-blue-600 hover:underline">{plan} plan</Link>.</span>
    </div>
  )
}

export function AssignmentDetailClient({
  assignment: initial,
  userId,
  isAssignee,
  isManager,
  wcComments = true,
  wcHistory  = true,
}: {
  assignment: Assignment
  userId: string
  isAssignee: boolean
  isManager: boolean
  wcComments?: boolean
  wcHistory?:  boolean
}) {
  const router = useRouter()
  const [assignment, setAssignment] = useState(initial)
  const [comment, setComment]       = useState("")
  const [posting, setPosting]       = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  const StatusIcon   = STATUS_ICON[assignment.status]
  const transitions  = STATUS_TRANSITIONS[assignment.status]
  const canTransition = isAssignee || isManager

  async function changeStatus(toStatus: Status) {
    if (transitioning) return
    setTransitioning(true)
    try {
      const res = await fetch(`/api/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus }),
      })
      if (res.ok) {
        const { assignment: updated } = await res.json() as { assignment: Assignment }
        setAssignment(p => ({ ...p, status: updated.status, completedAt: updated.completedAt }))
        router.refresh()
      }
    } finally {
      setTransitioning(false)
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim() || posting) return
    setPosting(true)
    try {
      const res = await fetch(`/api/assignments/${assignment.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment }),
      })
      if (res.ok) {
        const { comment: c } = await res.json() as { comment: Comment }
        setAssignment(p => ({ ...p, comments: [...p.comments, c] }))
        setComment("")
      }
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-start gap-3 mb-4">
          <StatusIcon className={cn("w-6 h-6 mt-0.5 flex-shrink-0", STATUS_COLOR[assignment.status])} />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{assignment.title}</h1>
            {assignment.description && (
              <p className="mt-1 text-gray-600 dark:text-gray-400 text-sm">{assignment.description}</p>
            )}
          </div>
          <span className={cn("px-2 py-1 rounded-full text-xs font-medium flex-shrink-0", PRIORITY_COLOR[assignment.priority])}>
            {assignment.priority}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="text-gray-500">Assigned to</div>
          <div className="text-gray-900 dark:text-white font-medium">{assignment.assignee.name}</div>

          <div className="text-gray-500">Assigned by</div>
          <div className="text-gray-900 dark:text-white">{assignment.assignedBy.name}</div>

          <div className="text-gray-500">Status</div>
          <div className={cn("font-medium capitalize", STATUS_COLOR[assignment.status])}>
            {assignment.status.replace("_", " ")}
          </div>

          {assignment.dueDate && (
            <>
              <div className="text-gray-500">Due</div>
              <div className={cn("font-medium",
                new Date(assignment.dueDate) < new Date() && assignment.status !== "completed"
                  ? "text-red-500" : "text-gray-900 dark:text-white"
              )}>
                {new Date(assignment.dueDate).toLocaleString()}
              </div>
            </>
          )}

          {assignment.completedAt && (
            <>
              <div className="text-gray-500">Completed</div>
              <div className="text-green-600 dark:text-green-400 font-medium">
                {new Date(assignment.completedAt).toLocaleString()}
              </div>
            </>
          )}
        </div>

        {/* Linked objects */}
        {(assignment.linkedIssue || assignment.linkedAsset || assignment.linkedVendor || assignment.linkedSop) && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-2">
            {assignment.linkedIssue && (
              <Link href={`/issues/${assignment.linkedIssue.id}`}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Issue: {assignment.linkedIssue.title}
              </Link>
            )}
            {assignment.linkedAsset && (
              <Link href={`/assets/${assignment.linkedAsset.id}`}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-full text-xs font-medium hover:bg-purple-100 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Asset: {assignment.linkedAsset.name}
              </Link>
            )}
            {assignment.linkedVendor && (
              <Link href={`/vendors/${assignment.linkedVendor.id}`}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-medium hover:bg-green-100 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Vendor: {assignment.linkedVendor.name}
              </Link>
            )}
            {assignment.linkedSop && (
              <Link href={`/sops/${assignment.linkedSop.id}`}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium hover:bg-amber-100 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                SOP: {assignment.linkedSop.title}
              </Link>
            )}
          </div>
        )}

        {/* Status actions */}
        {canTransition && transitions.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {transitions.map(t => (
              <button
                key={t}
                onClick={() => changeStatus(t)}
                disabled={transitioning}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
                  t === "completed"    ? "bg-green-600 text-white hover:bg-green-700" :
                  t === "cancelled"    ? "border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700" :
                  t === "in_progress"  ? "bg-yellow-500 text-white hover:bg-yellow-600" :
                  "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                Mark as {t.replace("_", " ")}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {assignment.notes && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-amber-900 dark:text-amber-200">{assignment.notes}</p>
        </div>
      )}

      {/* Status history */}
      {wcHistory ? (
        assignment.statusHistory.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">History</h2>
            <div className="space-y-2">
              {assignment.statusHistory.map(e => (
                <div key={e.id} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-gray-900 dark:text-white">
                      {e.fromStatus ? `${e.fromStatus.replace("_", " ")} → ` : ""}{e.toStatus.replace("_", " ")}
                    </span>
                    {e.note && <span className="text-gray-500 ml-1.5">— {e.note}</span>}
                    <div className="text-xs text-gray-400 mt-0.5">{e.changedBy.name} · {formatTs(e.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <LockedFeature feature="Assignment history" plan="Professional" />
      )}

      {/* Conversation */}
      {wcComments ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Conversation {assignment.comments.length > 0 && `(${assignment.comments.length})`}
            </h2>
          </div>

          {assignment.comments.length === 0 && (
            <p className="text-sm text-gray-400 mb-4">No comments yet. Start the conversation below.</p>
          )}

          <div className="space-y-3 mb-4">
            {assignment.comments.map(c => (
              <div key={c.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300 flex-shrink-0">
                  {c.author.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{c.author.name}</span>
                    <span className="text-xs text-gray-400">{formatTs(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{c.content}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={postComment} className="flex gap-2">
            <input
              value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit" disabled={posting || !comment.trim()}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        <LockedFeature feature="Assignment comments" plan="Professional" />
      )}

      {/* Edit link for managers */}
      {isManager && (
        <div className="flex justify-end">
          <Link
            href={`/assignments/new?edit=${assignment.id}`}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Edit assignment
          </Link>
        </div>
      )}
    </div>
  )
}

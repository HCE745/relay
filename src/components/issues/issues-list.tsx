"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ChevronRight, Download, UserCheck, AlertCircle, CheckSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PRIORITY_COLOR, STATUS_COLOR, ISSUE_STATUS, ISSUE_PRIORITY, ISSUE_CATEGORY } from "@/lib/constants"
import { toast } from "@/lib/toast"
import { CopyLink } from "@/components/ui/copy-link"

interface Issue {
  id: string
  title: string
  status: string
  priority: string
  category: string
  isEscalated: boolean
  escalationLevel: number
  createdAt: Date | string
  reportedBy: { name: string }
  assignedTo: { name: string } | null
  location: { name: string } | null
  _count: { comments: number }
}

interface User {
  id: string
  name: string
  role: string
}

interface Props {
  issues: Issue[]
  users: User[]
  currentFilters: Record<string, string>
}

export function IssuesList({ issues, users, currentFilters }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected(prev => prev.size === issues.length ? new Set() : new Set(issues.map(i => i.id)))
  }, [issues])

  async function doBulk(action: "status" | "assignee" | "priority", value: string | null) {
    if (!selected.size) return
    setBulkLoading(true)
    try {
      const res = await fetch("/api/issues/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueIds: Array.from(selected), action, value }),
      })
      if (res.ok) {
        toast.success(`Updated ${selected.size} issue${selected.size > 1 ? "s" : ""}`)
        setSelected(new Set())
        router.refresh()
      } else {
        toast.error("Bulk update failed")
      }
    } catch {
      toast.error("Connection error")
    } finally {
      setBulkLoading(false)
    }
  }

  function buildExportUrl() {
    const params = new URLSearchParams(currentFilters)
    return `/api/export/issues?${params.toString()}`
  }

  const allSelected = selected.size === issues.length && issues.length > 0
  const someSelected = selected.size > 0

  return (
    <div>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {someSelected ? (
          <>
            <span className="text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              {selected.size} selected
            </span>

            <select
              onChange={e => { if (e.target.value) { doBulk("status", e.target.value); e.target.value = "" } }}
              disabled={bulkLoading}
              className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Change status…</option>
              {Object.entries(ISSUE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            <select
              onChange={e => { if (e.target.value) { doBulk("priority", e.target.value); e.target.value = "" } }}
              disabled={bulkLoading}
              className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Change priority…</option>
              {Object.entries(ISSUE_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            <select
              onChange={e => { doBulk("assignee", e.target.value || null); e.target.value = "" }}
              disabled={bulkLoading}
              className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Assign to…</option>
              <option value="">Unassign</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>

            <a
              href={`/api/export/issues?ids=${Array.from(selected).join(",")}`}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export selected
            </a>

            <button
              onClick={() => setSelected(new Set())}
              className="text-sm text-gray-500 hover:text-gray-700 px-2"
            >
              Clear
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 ml-auto">
            <a
              href={buildExportUrl()}
              download
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {issues.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm mb-4">No issues found</p>
            <Link href="/issues/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Report First Issue
            </Link>
          </div>
        ) : (
          <>
            {/* ── Mobile card list ───────────────────────────────────────── */}
            <div className="md:hidden divide-y divide-gray-100">
              {issues.map((issue) => (
                <div key={issue.id} className="flex items-start gap-3 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={selected.has(issue.id)}
                    onChange={() => toggleOne(issue.id)}
                    onClick={e => e.stopPropagation()}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                  <Link href={`/issues/${issue.id}`} className="flex-1 min-w-0 hover:text-blue-600">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={`text-xs ${PRIORITY_COLOR[issue.priority]}`}>
                        {ISSUE_PRIORITY[issue.priority as keyof typeof ISSUE_PRIORITY] ?? issue.priority}
                      </Badge>
                      <Badge className={`text-xs ${STATUS_COLOR[issue.status]}`}>
                        {ISSUE_STATUS[issue.status as keyof typeof ISSUE_STATUS] ?? issue.status}
                      </Badge>
                      {issue.isEscalated && <span className="text-xs text-red-500 font-medium">Escalated</span>}
                    </div>
                    <p className="font-medium text-sm text-gray-900 leading-snug">{issue.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                      <span>by {issue.reportedBy.name}</span>
                      {issue.location && <span>· {issue.location.name}</span>}
                      {issue.assignedTo && <span>· → {issue.assignedTo.name}</span>}
                      {issue._count.comments > 0 && <span>· {issue._count.comments} comment{issue._count.comments !== 1 ? "s" : ""}</span>}
                    </div>
                  </Link>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
                </div>
              ))}
            </div>

            {/* ── Desktop table ──────────────────────────────────────────── */}
            <table className="hidden md:table w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Issue</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Priority</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Category</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Assigned To</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Location</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {issues.map((issue) => (
                  <tr
                    key={issue.id}
                    className={`hover:bg-gray-50 transition-colors ${selected.has(issue.id) ? "bg-blue-50/50" : ""}`}
                  >
                    <td className="px-4 py-4 w-10" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(issue.id)}
                        onChange={() => toggleOne(issue.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-1.5">
                        <Link href={`/issues/${issue.id}`} className="group flex-1 min-w-0">
                          <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors text-sm">{issue.title}</div>
                          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                            <span>by {issue.reportedBy.name}</span>
                            {issue._count.comments > 0 && <span>· {issue._count.comments} comment{issue._count.comments > 1 ? "s" : ""}</span>}
                            {issue.isEscalated && <span className="text-red-500 font-medium">· Escalated (L{issue.escalationLevel})</span>}
                          </div>
                        </Link>
                        <CopyLink url={`${typeof window !== "undefined" ? window.location.origin : ""}/issues/${issue.id}`} />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge className={PRIORITY_COLOR[issue.priority]}>
                        {ISSUE_PRIORITY[issue.priority as keyof typeof ISSUE_PRIORITY] ?? issue.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge className={STATUS_COLOR[issue.status]}>
                        {ISSUE_STATUS[issue.status as keyof typeof ISSUE_STATUS] ?? issue.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {ISSUE_CATEGORY[issue.category as keyof typeof ISSUE_CATEGORY] ?? issue.category}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {issue.assignedTo?.name ?? <span className="text-gray-300">Unassigned</span>}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{issue.location?.name ?? "—"}</td>
                    <td className="px-4 py-4 text-xs text-gray-400 whitespace-nowrap">
                      {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {issues.length > 0 && (
        <p className="mt-3 text-sm text-gray-400">
          {someSelected
            ? <><CheckSquare className="inline w-3.5 h-3.5 mr-1" />{selected.size} of {issues.length} selected</>
            : <>{issues.length} issue{issues.length !== 1 ? "s" : ""}</>
          }
        </p>
      )}
    </div>
  )
}

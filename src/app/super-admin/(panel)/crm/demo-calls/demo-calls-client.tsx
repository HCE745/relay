"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { PhoneCall, Plus, X, CheckCircle2, Clock, AlertCircle, ChevronRight } from "lucide-react"
import { CrmDemoCallForm } from "@/components/super-admin/crm-demo-call-form"
import { CrmSchedulingButton, CrmSchedulingButtonFallback } from "@/components/super-admin/crm-scheduling-button"

interface DemoCall {
  id:                string
  contactName:       string
  contactEmail:      string
  contactPhone:      string | null
  companyName:       string
  industry:          string | null
  callStatus:        string
  scheduledAt:       string | null
  leadSource:        string
  outcome:           string | null
  followUpDate:      string | null
  followUpCompleted: boolean
  organization:      { id: string; name: string } | null
}

const STATUSES = ["", "Scheduled", "Completed", "Cancelled", "No Show", "Rescheduled"] as const

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  Scheduled:   { label: "Scheduled",   badge: "bg-blue-900/60 text-blue-300 border border-blue-700",      dot: "bg-blue-500"   },
  Completed:   { label: "Completed",   badge: "bg-green-900/60 text-green-300 border border-green-700",   dot: "bg-green-500"  },
  Cancelled:   { label: "Cancelled",   badge: "bg-gray-800 text-gray-400 border border-gray-700",         dot: "bg-gray-500"   },
  "No Show":   { label: "No Show",     badge: "bg-red-900/60 text-red-300 border border-red-700",         dot: "bg-red-500"    },
  Rescheduled: { label: "Rescheduled", badge: "bg-amber-900/60 text-amber-300 border border-amber-700",   dot: "bg-amber-500"  },
}

export function DemoCallsClient({ schedulingUrl }: { schedulingUrl: string | null }) {
  const [calls, setCalls]       = useState<DemoCall[]>([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [statusFilter, setStatusFilter] = useState("")
  const [completing, setCompleting]     = useState<string | null>(null)

  const loadCalls = useCallback(async () => {
    setLoading(true)
    const qs  = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ""
    const res = await fetch(`/api/super-admin/crm/demo-calls${qs}`)
    const data = await res.json() as { calls: DemoCall[] }
    setCalls(data.calls)
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { void loadCalls() }, [loadCalls])

  async function markComplete(id: string) {
    setCompleting(id)
    await fetch(`/api/super-admin/crm/demo-calls/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ callStatus: "Completed", outcome: "Completed" }),
    })
    setCompleting(null)
    void loadCalls()
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this demo call?")) return
    await fetch(`/api/super-admin/crm/demo-calls/${id}`, { method: "DELETE" })
    void loadCalls()
  }

  const now = new Date()

  // Count badges per status for tab pills
  const countsByStatus = calls.reduce<Record<string, number>>((acc, c) => {
    acc[c.callStatus] = (acc[c.callStatus] ?? 0) + 1
    return acc
  }, {})
  const totalCount = calls.length

  return (
    <div className="p-6 md:p-8 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Demo Calls</h1>
          <p className="text-gray-400 text-sm mt-1">
            Track every prospect conversation — from first call to conversion
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {schedulingUrl
            ? <CrmSchedulingButton url={schedulingUrl} />
            : <CrmSchedulingButtonFallback />
          }
          <button
            onClick={() => setCreating(c => !c)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-sm font-medium rounded-lg transition-colors"
          >
            {creating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {creating ? "Cancel" : "Log Call"}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {creating && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-indigo-400" />
            Log New Demo Call
          </h2>
          <CrmDemoCallForm
            onSuccess={() => { setCreating(false); void loadCalls() }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {STATUSES.map(s => {
          const count = s === "" ? totalCount : (countsByStatus[s] ?? 0)
          const cfg   = s ? STATUS_CONFIG[s] : null
          const isActive = statusFilter === s
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              {cfg && (
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              )}
              {s || "All"}
              <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${isActive ? "bg-indigo-500 text-white" : "bg-gray-700 text-gray-400"}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState />
      ) : calls.length === 0 && statusFilter === "" ? (
        <EmptyState onNew={() => setCreating(true)} schedulingUrl={schedulingUrl} />
      ) : calls.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-12 text-center">
          <p className="text-gray-500 text-sm">No {statusFilter.toLowerCase()} calls found.</p>
          <button onClick={() => setStatusFilter("")} className="text-xs text-indigo-400 hover:underline mt-2">
            Clear filter
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="min-w-full">
            <thead className="border-b border-gray-800">
              <tr>
                {["Contact", "Company / Industry", "Status", "Scheduled", "Follow-up", "Linked Org", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {calls.map(call => {
                const followUpOverdue = call.followUpDate && !call.followUpCompleted && new Date(call.followUpDate) < now
                const followUpSoon    = call.followUpDate && !call.followUpCompleted && !followUpOverdue &&
                  new Date(call.followUpDate) < new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
                const cfg = STATUS_CONFIG[call.callStatus]
                const canComplete = call.callStatus === "Scheduled" || call.callStatus === "Rescheduled"

                return (
                  <tr key={call.id} className="hover:bg-gray-800/40 transition-colors group">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-white">{call.contactName}</p>
                      <p className="text-xs text-gray-500">{call.contactEmail}</p>
                      {call.contactPhone && (
                        <p className="text-xs text-gray-600">{call.contactPhone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-gray-200">{call.companyName}</p>
                      {call.industry && <p className="text-xs text-gray-500">{call.industry}</p>}
                      <p className="text-xs text-gray-600 mt-0.5">{call.leadSource}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg?.badge ?? "bg-gray-800 text-gray-400 border border-gray-700"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot ?? "bg-gray-500"}`} />
                        {call.callStatus}
                      </span>
                      {call.outcome && (
                        <p className="text-xs text-gray-600 mt-1 truncate max-w-[120px]">{call.outcome}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-400 whitespace-nowrap">
                      {call.scheduledAt
                        ? new Date(call.scheduledAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                        : <span className="text-gray-700">—</span>
                      }
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {call.followUpDate ? (
                        <div className={`flex items-center gap-1.5 text-xs font-medium ${
                          followUpOverdue ? "text-red-400" :
                          followUpSoon    ? "text-amber-400" :
                          call.followUpCompleted ? "text-green-500" : "text-gray-400"
                        }`}>
                          {followUpOverdue ? <AlertCircle className="w-3.5 h-3.5" /> :
                           call.followUpCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                           <Clock className="w-3.5 h-3.5" />}
                          {new Date(call.followUpDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                          {followUpOverdue && <span className="text-red-500 text-[10px]">overdue</span>}
                          {call.followUpCompleted && <span className="text-green-600 text-[10px]">done</span>}
                        </div>
                      ) : (
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm">
                      {call.organization ? (
                        <Link href={`/super-admin/organizations/${call.organization.id}`}
                          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                          {call.organization.name}
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canComplete && (
                          <button
                            onClick={() => markComplete(call.id)}
                            disabled={completing === call.id}
                            className="text-xs px-2 py-1 bg-green-800/60 hover:bg-green-700/60 text-green-300 rounded-md font-medium transition-colors disabled:opacity-50"
                          >
                            {completing === call.id ? "…" : "Complete"}
                          </button>
                        )}
                        <Link href={`/super-admin/crm/demo-calls/${call.id}`}
                          className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md font-medium transition-colors">
                          Edit
                        </Link>
                        <button onClick={() => handleDelete(call.id)}
                          className="text-xs px-2 py-1 bg-red-950/60 hover:bg-red-900/60 text-red-400 rounded-md font-medium transition-colors">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EmptyState({ onNew, schedulingUrl }: { onNew: () => void; schedulingUrl: string | null }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-indigo-900/40 border border-indigo-800 flex items-center justify-center mx-auto mb-4">
        <PhoneCall className="w-6 h-6 text-indigo-400" />
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">No demo calls logged yet</h3>
      <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
        Calendly bookings sync here automatically. You can also log calls manually —
        follow-up reminders and conversion tracking are built in.
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {schedulingUrl && (
          <a
            href={schedulingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PhoneCall className="w-4 h-4" />
            Open Booking Page
          </a>
        )}
        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log a Call Manually
        </button>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-4 bg-gray-800 rounded w-32 animate-pulse" />
          <div className="h-4 bg-gray-800 rounded w-24 animate-pulse" />
          <div className="h-4 bg-gray-800 rounded w-16 animate-pulse" />
          <div className="h-4 bg-gray-800 rounded w-20 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

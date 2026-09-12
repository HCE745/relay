"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ArrowLeft, CheckCircle2, Circle, Clock, DollarSign,
  User, Calendar, FileText, Loader2, AlertCircle, Plus, RefreshCw,
} from "lucide-react"

type Task = {
  id: string
  title: string
  taskType: string | null
  dueAt: string | null
  priority: string | null
  completedAt: string | null
}

type CommissionEvent = {
  id: string
  role: string
  amount: number | null
  splitPct: number | null
  salesUser: { name: string } | null
}

type Opportunity = {
  id: string
  title: string
  stage: string
  value: number | null
  product: string | null
  closeDate: string | null
  notes: string | null
  assignedToId: string | null
  assignedTo: { id: string; name: string } | null
  prospect: { id: string; contactName: string; companyName: string | null } | null
  demoCallId: string | null
  tasks: Task[]
  commissionEvents: CommissionEvent[]
}

type AuthInfo = { superAdmin?: boolean; salesUserId?: string; salesUserRole?: string }

const STAGES = ["Qualified", "Demo", "Proposal", "Negotiating", "Closed Won", "Closed Lost"]

const STAGE_COLORS: Record<string, string> = {
  "Qualified":   "bg-blue-900/40 text-blue-300",
  "Demo":        "bg-indigo-900/40 text-indigo-300",
  "Proposal":    "bg-yellow-900/40 text-yellow-300",
  "Negotiating": "bg-orange-900/40 text-orange-300",
  "Closed Won":  "bg-green-900/40 text-green-300",
  "Closed Lost": "bg-gray-800 text-gray-400",
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-400",
  high:   "text-orange-400",
  normal: "text-gray-400",
  low:    "text-gray-600",
}

function fmtValue(v: number | null | undefined) {
  if (v == null) return "—"
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v}`
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString()
}

export default function OpportunityDetailPage({ params }: { params: { id: string } }) {
  const [opp, setOpp] = useState<Opportunity | null>(null)
  const [auth, setAuth] = useState<AuthInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Task form
  const [taskTitle, setTaskTitle] = useState("")
  const [taskType, setTaskType] = useState("call")
  const [taskDue, setTaskDue] = useState("")
  const [taskSaving, setTaskSaving] = useState(false)

  // Stage change
  const [newStage, setNewStage] = useState("")
  const [stageSaving, setStageSaving] = useState(false)

  // Transfer
  const [transferTo, setTransferTo] = useState("")
  const [transferNote, setTransferNote] = useState("")
  const [transferSaving, setTransferSaving] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [oppRes, authRes] = await Promise.all([
          fetch(`/api/sales/opportunities/${params.id}`),
          fetch("/api/sales/auth"),
        ])
        if (!oppRes.ok) throw new Error("Failed to load opportunity")
        const oppData = await oppRes.json()
        const authData = authRes.ok ? await authRes.json() : {}
        setOpp(oppData)
        setAuth(authData)
        setNewStage(oppData.stage ?? "")
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error loading opportunity")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskTitle.trim()) return
    setTaskSaving(true)
    try {
      const res = await fetch("/api/sales/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opportunityId: params.id,
          title: taskTitle.trim(),
          taskType,
          dueAt: taskDue || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to add task")
      const task = await res.json()
      setOpp(prev => prev ? { ...prev, tasks: [...prev.tasks, task] } : prev)
      setTaskTitle("")
      setTaskDue("")
    } catch {
      alert("Failed to add task")
    } finally {
      setTaskSaving(false)
    }
  }

  async function changeStage() {
    if (!newStage || newStage === opp?.stage) return
    setStageSaving(true)
    try {
      const res = await fetch(`/api/sales/opportunities/${params.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      })
      if (!res.ok) throw new Error("Failed to update stage")
      const updated = await res.json()
      setOpp(prev => prev ? { ...prev, stage: updated.stage } : prev)
    } catch {
      alert("Failed to update stage")
    } finally {
      setStageSaving(false)
    }
  }

  async function requestTransfer(e: React.FormEvent) {
    e.preventDefault()
    setTransferSaving(true)
    try {
      const res = await fetch("/api/sales/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opportunityId: params.id, toUserId: transferTo, note: transferNote }),
      })
      if (!res.ok) throw new Error("Failed to request transfer")
      setShowTransfer(false)
      setTransferTo("")
      setTransferNote("")
      alert("Transfer request submitted")
    } catch {
      alert("Failed to submit transfer request")
    } finally {
      setTransferSaving(false)
    }
  }

  const isManager = auth?.superAdmin || auth?.salesUserRole === "admin_sales"

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    )
  }

  if (error || !opp) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>{error ?? "Opportunity not found"}</p>
        </div>
        <Link href="/sales/opportunities" className="text-sm text-gray-500 hover:text-gray-300 mt-4 inline-block">
          ← Back to opportunities
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Back + header */}
      <div>
        <Link href="/sales/opportunities" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Opportunities
        </Link>

        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white mb-1">{opp.title}</h1>
            <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ${STAGE_COLORS[opp.stage] ?? "bg-gray-800 text-gray-400"}`}>
              {opp.stage}
            </span>
          </div>
          <div className="text-right shrink-0">
            {opp.value != null && (
              <div className="flex items-center gap-1 text-2xl font-bold text-emerald-400 justify-end">
                <DollarSign className="w-5 h-5" />
                {fmtValue(opp.value).replace("$", "")}
              </div>
            )}
            {opp.closeDate && (
              <p className="text-xs text-gray-500 mt-0.5">Close {fmtDate(opp.closeDate)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 grid grid-cols-2 gap-4">
        {opp.product && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Product</p>
            <p className="text-sm text-white">{opp.product}</p>
          </div>
        )}
        {opp.assignedTo && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Assigned To</p>
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-sm text-white">{opp.assignedTo.name}</p>
            </div>
          </div>
        )}
        {opp.prospect && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Prospect</p>
            <Link href={`/sales/outreach/prospects/${opp.prospect.id}`} className="text-sm text-emerald-400 hover:text-emerald-300">
              {opp.prospect.companyName ?? opp.prospect.contactName}
            </Link>
          </div>
        )}
        {opp.demoCallId && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Demo Call</p>
            <Link href={`/super-admin/crm/demo-calls/${opp.demoCallId}`} className="text-sm text-indigo-400 hover:text-indigo-300">
              View demo call ↗
            </Link>
          </div>
        )}
        {opp.notes && (
          <div className="col-span-2">
            <p className="text-xs text-gray-500 mb-0.5">Notes</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{opp.notes}</p>
          </div>
        )}
      </div>

      {/* Stage change */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <p className="text-xs font-semibold text-gray-400 mb-3">Change Stage</p>
        <div className="flex items-center gap-3">
          <select
            value={newStage}
            onChange={e => setNewStage(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
          >
            {STAGES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={changeStage}
            disabled={stageSaving || newStage === opp.stage}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            {stageSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Update
          </button>
        </div>
      </div>

      {/* Tasks */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <p className="text-xs font-semibold text-gray-400 mb-4">Tasks</p>

        {opp.tasks.length === 0 ? (
          <p className="text-sm text-gray-600 mb-4">No tasks yet.</p>
        ) : (
          <div className="space-y-2 mb-5">
            {opp.tasks.map(task => {
              const done = !!task.completedAt
              const overdue = !done && task.dueAt && new Date(task.dueAt) < new Date()
              return (
                <div key={task.id} className="flex items-center gap-3 py-2 border-b border-gray-700/60 last:border-0">
                  {done
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    : <Circle className={`w-4 h-4 shrink-0 ${overdue ? "text-red-400" : "text-gray-600"}`} />
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${done ? "line-through text-gray-500" : "text-white"}`}>{task.title}</p>
                    {task.taskType && <p className="text-xs text-gray-600">{task.taskType}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.priority && (
                      <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority] ?? "text-gray-500"}`}>
                        {task.priority}
                      </span>
                    )}
                    {task.dueAt && (
                      <div className={`flex items-center gap-1 text-xs ${overdue ? "text-red-400" : "text-gray-500"}`}>
                        <Clock className="w-3 h-3" />
                        {fmtDate(task.dueAt)}
                      </div>
                    )}
                    {task.completedAt && (
                      <span className="text-xs text-gray-600">Done {fmtDate(task.completedAt)}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add task form */}
        <form onSubmit={addTask} className="border-t border-gray-700 pt-4 space-y-3">
          <p className="text-xs text-gray-500 font-medium">Add Task</p>
          <input
            value={taskTitle}
            onChange={e => setTaskTitle(e.target.value)}
            placeholder="Task title…"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600"
          />
          <div className="flex gap-3">
            <select
              value={taskType}
              onChange={e => setTaskType(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
            >
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="follow_up">Follow-up</option>
              <option value="other">Other</option>
            </select>
            <input
              type="date"
              value={taskDue}
              onChange={e => setTaskDue(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              disabled={taskSaving || !taskTitle.trim()}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              {taskSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add
            </button>
          </div>
        </form>
      </div>

      {/* Commission events — managers only */}
      {isManager && opp.commissionEvents.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 mb-4">Commission Events</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-700">
                  <th className="text-left pb-2 font-medium">Role</th>
                  <th className="text-left pb-2 font-medium">Rep</th>
                  <th className="text-left pb-2 font-medium">Split %</th>
                  <th className="text-left pb-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {opp.commissionEvents.map(ev => (
                  <tr key={ev.id}>
                    <td className="py-2 text-gray-300">{ev.role}</td>
                    <td className="py-2 text-gray-300">{ev.salesUser?.name ?? "—"}</td>
                    <td className="py-2 text-gray-400">{ev.splitPct != null ? `${ev.splitPct}%` : "—"}</td>
                    <td className="py-2 text-emerald-400 font-medium">{fmtValue(ev.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfer */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400">Transfer Ownership</p>
          <button
            onClick={() => setShowTransfer(v => !v)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showTransfer ? "Cancel" : "Request Transfer"}
          </button>
        </div>
        {showTransfer && (
          <form onSubmit={requestTransfer} className="space-y-3">
            <input
              value={transferTo}
              onChange={e => setTransferTo(e.target.value)}
              placeholder="Target user ID or email…"
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600"
            />
            <textarea
              value={transferNote}
              onChange={e => setTransferNote(e.target.value)}
              placeholder="Note (optional)…"
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 resize-none"
            />
            <button
              type="submit"
              disabled={transferSaving}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              {transferSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Submit Request
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

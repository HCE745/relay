"use client"

import { useEffect, useState } from "react"
import { Target, Plus, Trash2, TrendingUp, Calendar, Users } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Goal {
  id: string; metric: string; period: string; targetValue: string
  startDate: string; endDate: string; notes: string | null; createdAt: string
  salesUser: { id: string; name: string } | null
}

interface SalesUser { id: string; name: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  emailsSent:              "Emails Sent",
  prospectsAdded:          "Prospects Added",
  demosLogged:             "Demos Logged",
  opportunitiesCreated:    "Opportunities Created",
  revenueWon:              "Revenue Won ($)",
  dealsWon:                "Deals Won",
  callsMade:               "Calls Made",
  prospectsContacted:      "Prospects Contacted",
}

const PERIOD_LABELS: Record<string, string> = {
  daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly",
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function progressPct(goal: Goal, actuals: Record<string, number>) {
  const actual = actuals[`${goal.id}`] ?? 0
  const target = Number(goal.targetValue)
  if (target === 0) return 0
  return Math.min(100, Math.round((actual / target) * 100))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [goals, setGoals]         = useState<Goal[]>([])
  const [actuals, setActuals]     = useState<Record<string, number>>({})
  const [users, setUsers]         = useState<SalesUser[]>([])
  const [isManager, setIsManager] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [period, setPeriod]       = useState("monthly")
  const [creating, setCreating]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    salesUserId: "",
    metric: "emailsSent",
    period: "monthly",
    targetValue: "",
    startDate: "",
    endDate: "",
    notes: "",
  })

  async function load() {
    setLoading(true)
    try {
      const [goalsRes, usersRes, sessionRes] = await Promise.all([
        fetch(`/api/sales/goals?period=${period}`),
        fetch("/api/sales/users"),
        fetch("/api/sales/auth/session"),
      ])
      if (goalsRes.ok) {
        const d = await goalsRes.json() as { goals: Goal[] }
        setGoals(d.goals)
        // Fetch actuals for all returned goals
        if (d.goals.length > 0) {
          const ids = d.goals.map(g => g.id).join(",")
          const progressRes = await fetch(`/api/sales/goals/progress?goalIds=${ids}`)
          if (progressRes.ok) {
            const p = await progressRes.json() as { actuals: Record<string, number> }
            setActuals(p.actuals)
          }
        }
      }
      if (usersRes.ok) {
        const d = await usersRes.json() as { users: SalesUser[] }
        setUsers(d.users)
      }
      if (sessionRes.ok) {
        const d = await sessionRes.json() as { superAdmin?: boolean; salesUserRole?: string }
        setIsManager(!!(d.superAdmin || d.salesUserRole === "admin_sales"))
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [period])

  async function createGoal() {
    if (!form.targetValue || !form.startDate || !form.endDate) return
    setSaving(true)
    try {
      const res = await fetch("/api/sales/goals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesUserId:  form.salesUserId || null,
          metric:       form.metric,
          period:       form.period,
          targetValue:  Number(form.targetValue),
          startDate:    form.startDate,
          endDate:      form.endDate,
          notes:        form.notes || null,
        }),
      })
      if (res.ok) {
        const d = await res.json() as { goal: Goal }
        // Fetch actuals for the new goal
        const progressRes = await fetch(`/api/sales/goals/progress?goalIds=${d.goal.id}`)
        if (progressRes.ok) {
          const p = await progressRes.json() as { actuals: Record<string, number> }
          setActuals(prev => ({ ...prev, ...p.actuals }))
        }
        setGoals(gs => [d.goal, ...gs])
        setCreating(false)
        setForm({ salesUserId: "", metric: "emailsSent", period: "monthly", targetValue: "", startDate: "", endDate: "", notes: "" })
      }
    } finally { setSaving(false) }
  }

  async function deleteGoal(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/sales/goals/${id}`, { method: "DELETE" })
      setGoals(gs => gs.filter(g => g.id !== id))
    } finally { setDeletingId(null) }
  }

  const teamGoals = goals.filter(g => !g.salesUser)
  const repGoals  = goals.filter(g =>  g.salesUser)

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Sales Goals</h1>
            <p className="text-gray-500 text-sm mt-0.5">Track targets and progress</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
            {Object.entries(PERIOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {isManager && (
            <button onClick={() => setCreating(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> New Goal
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {creating && isManager && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6 space-y-4">
          <p className="text-sm font-semibold text-white">Create Goal</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rep (blank = team-wide)</label>
              <select value={form.salesUserId} onChange={e => setForm(f => ({ ...f, salesUserId: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="">Team (all reps)</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Metric</label>
              <select value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                {Object.entries(METRIC_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Period</label>
              <select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                {Object.entries(PERIOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Target</label>
              <input type="number" min="1" placeholder="e.g. 50" value={form.targetValue}
                onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
              <input placeholder="Context or expectations…" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createGoal} disabled={saving || !form.targetValue || !form.startDate || !form.endDate}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              Create Goal
            </button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-16 text-gray-600">Loading goals…</div>}

      {!loading && goals.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <Target className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No goals set for this period.</p>
          {isManager && <p className="text-gray-600 text-sm mt-1">Create a goal above to get started.</p>}
        </div>
      )}

      {/* Team goals */}
      {teamGoals.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-500" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Team Goals</h2>
          </div>
          <div className="space-y-3">
            {teamGoals.map(g => <GoalCard key={g.id} goal={g} actual={actuals[g.id] ?? 0} isManager={isManager} deleting={deletingId === g.id} onDelete={deleteGoal} />)}
          </div>
        </div>
      )}

      {/* Per-rep goals */}
      {repGoals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Individual Goals</h2>
          </div>
          <div className="space-y-3">
            {repGoals.map(g => <GoalCard key={g.id} goal={g} actual={actuals[g.id] ?? 0} isManager={isManager} deleting={deletingId === g.id} onDelete={deleteGoal} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function GoalCard({ goal, actual, isManager, deleting, onDelete }: {
  goal: Goal; actual: number; isManager: boolean; deleting: boolean; onDelete: (id: string) => void
}) {
  const target    = Number(goal.targetValue)
  const pct       = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
  const isRevenue = goal.metric === "revenueWon"
  const targetFmt = isRevenue ? `$${target.toLocaleString()}` : target.toLocaleString()
  const actualFmt = isRevenue ? `$${actual.toLocaleString()}` : actual.toLocaleString()

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white text-sm">{METRIC_LABELS[goal.metric] ?? goal.metric}</p>
            <span className="text-[10px] bg-indigo-900/40 text-indigo-300 px-1.5 py-0.5 rounded-full">{PERIOD_LABELS[goal.period] ?? goal.period}</span>
            {goal.salesUser && <span className="text-[10px] text-gray-500">{goal.salesUser.name}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("text-2xl font-bold", pct >= 100 ? "text-emerald-400" : "text-white")}>{actualFmt}</span>
            <span className="text-sm text-gray-500">/ {targetFmt}</span>
          </div>
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
            <Calendar className="w-3 h-3" />
            {fmtDate(goal.startDate)} – {fmtDate(goal.endDate)}
          </div>
          {goal.notes && <p className="text-xs text-gray-600 mt-1 italic">{goal.notes}</p>}
        </div>
        {isManager && (
          <button onClick={() => onDelete(goal.id)} disabled={deleting}
            className="shrink-0 p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress bar placeholder */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-emerald-500" : pct > 60 ? "bg-indigo-500" : pct > 30 ? "bg-yellow-500" : "bg-gray-600")}
            style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

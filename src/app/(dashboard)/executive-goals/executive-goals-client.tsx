"use client"

import { useState } from "react"
import { Target, Plus, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw, Pencil, Trash2 } from "lucide-react"

type GoalProgress = {
  id: string
  goalId: string
  value: number
  calculatedAt: Date | string
}

type Goal = {
  id: string
  title: string
  description?: string | null
  metricType: string
  targetValue: number
  currentValue: number
  unit: string
  targetDate: Date | string
  scope: string
  scopeId?: string | null
  status: string
  isAtRisk: boolean
  createdAt: Date | string
  updatedAt: Date | string
  progress: GoalProgress[]
}

type Props = {
  goals: Goal[]
  orgId: string
  userRole: string
}

const METRIC_TYPES = [
  { value: "injury_reduction", label: "Injury Reduction" },
  { value: "resolution_time", label: "Resolution Time" },
  { value: "recurring_failures", label: "Recurring Failures" },
  { value: "response_time", label: "Response Time" },
  { value: "escalation_rate", label: "Escalation Rate" },
  { value: "open_issue_volume", label: "Open Issue Volume" },
]

const SCOPES = [
  { value: "org", label: "Organization" },
  { value: "location", label: "Location" },
  { value: "region", label: "Region" },
  { value: "department", label: "Department" },
]

const UNITS = ["%", "hours", "count", "days"]

function StatusBadge({ status, isAtRisk }: { status: string; isAtRisk: boolean }) {
  if (isAtRisk) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
        <AlertTriangle className="w-3 h-3" /> At Risk
      </span>
    )
  }
  if (status === "ACHIEVED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
        <CheckCircle2 className="w-3 h-3" /> Achieved
      </span>
    )
  }
  if (status === "AT_RISK") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
        <AlertTriangle className="w-3 h-3" /> At Risk
      </span>
    )
  }
  if (status === "MISSED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
        <XCircle className="w-3 h-3" /> Missed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
      <Clock className="w-3 h-3" /> Active
    </span>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"
  return (
    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
      <div
        className={`h-2 ${color} rounded-full transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

type FormData = {
  title: string
  description: string
  metricType: string
  targetValue: string
  unit: string
  targetDate: string
  scope: string
}

function GoalForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<FormData>
  onSubmit: (data: FormData) => void
  onCancel: () => void
  loading: boolean
}) {
  const [form, setForm] = useState<FormData>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    metricType: initial?.metricType ?? "open_issue_volume",
    targetValue: initial?.targetValue ?? "",
    unit: initial?.unit ?? "%",
    targetDate: initial?.targetDate ?? "",
    scope: initial?.scope ?? "org",
  })

  function set(k: keyof FormData, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{initial?.title ? "Edit Goal" : "Create Goal"}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
          <input
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={form.title}
            onChange={e => set("title", e.target.value)}
            placeholder="Goal title"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={form.description}
            onChange={e => set("description", e.target.value)}
            rows={2}
            placeholder="Optional description"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Metric Type</label>
          <select
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={form.metricType}
            onChange={e => set("metricType", e.target.value)}
          >
            {METRIC_TYPES.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Target Value</label>
          <input
            type="number"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={form.targetValue}
            onChange={e => set("targetValue", e.target.value)}
            placeholder="e.g. 10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
          <select
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={form.unit}
            onChange={e => set("unit", e.target.value)}
          >
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Target Date</label>
          <input
            type="date"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={form.targetDate}
            onChange={e => set("targetDate", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Scope</label>
          <select
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={form.scope}
            onChange={e => set("scope", e.target.value)}
          >
            {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => onSubmit(form)}
          disabled={loading || !form.title || !form.targetValue || !form.targetDate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Goal
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function GoalCard({
  goal,
  isAdmin,
  onRecalculate,
  onEdit,
  onDelete,
  calculating,
}: {
  goal: Goal
  isAdmin: boolean
  onRecalculate: (id: string) => void
  onEdit: (goal: Goal) => void
  onDelete: (id: string) => void
  calculating: boolean
}) {
  const pct = goal.targetValue > 0 ? (goal.currentValue / goal.targetValue) * 100 : 0
  const targetDate = new Date(goal.targetDate)
  const now = new Date()
  const daysRemaining = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const isNearDeadline = daysRemaining > 0 && daysRemaining <= 7
  const isOverdue = daysRemaining < 0 && goal.status === "ACTIVE"
  const metricLabel = METRIC_TYPES.find(m => m.value === goal.metricType)?.label ?? goal.metricType

  return (
    <div className={`bg-white dark:bg-gray-800 border rounded-xl p-6 ${
      isNearDeadline ? "border-orange-300 dark:border-orange-700" : "border-gray-200 dark:border-gray-700"
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{goal.title}</h3>
            <StatusBadge status={goal.status} isAtRisk={goal.isAtRisk} />
            {isNearDeadline && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                <Clock className="w-3 h-3" /> {daysRemaining}d left
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                Overdue
              </span>
            )}
          </div>
          {goal.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{goal.description}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 ml-3 flex-shrink-0">
            <button
              onClick={() => onRecalculate(goal.id)}
              disabled={calculating}
              title="Recalculate"
              className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
            >
              {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onEdit(goal)}
              title="Edit"
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(goal.id)}
              title="Delete"
              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{metricLabel}</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {goal.currentValue.toFixed(1)} / {goal.targetValue} {goal.unit}
          </span>
        </div>
        <ProgressBar pct={pct} />
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{pct.toFixed(0)}% to target</span>
          <span>Due {targetDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
      </div>
    </div>
  )
}

export function ExecutiveGoalsClient({ goals: initial, orgId: _orgId, userRole }: Props) {
  const [goals, setGoals] = useState<Goal[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState<Record<string, boolean>>({})

  const isAdmin = userRole === "ADMIN"

  async function handleCreate(data: {
    title: string
    description: string
    metricType: string
    targetValue: string
    unit: string
    targetDate: string
    scope: string
  }) {
    setSaving(true)
    try {
      const res = await fetch("/api/executive-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: data.description || undefined,
          metricType: data.metricType,
          targetValue: parseFloat(data.targetValue),
          unit: data.unit,
          targetDate: new Date(data.targetDate).toISOString(),
          scope: data.scope,
        }),
      })
      if (res.ok) {
        const newGoal = await res.json()
        setGoals(prev => [...prev, newGoal])
        setShowForm(false)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? "Failed to create goal")
      }
    } catch {
      alert("Network error creating goal")
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(data: {
    title: string
    description: string
    metricType: string
    targetValue: string
    unit: string
    targetDate: string
    scope: string
  }) {
    if (!editGoal) return
    setSaving(true)
    try {
      const res = await fetch(`/api/executive-goals/${editGoal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: data.description || undefined,
          metricType: data.metricType,
          targetValue: parseFloat(data.targetValue),
          unit: data.unit,
          targetDate: new Date(data.targetDate).toISOString(),
          scope: data.scope,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setGoals(prev => prev.map(g => g.id === updated.id ? updated : g))
        setEditGoal(null)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? "Failed to update goal")
      }
    } catch {
      alert("Network error updating goal")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this goal? This cannot be undone.")) return
    try {
      const res = await fetch(`/api/executive-goals/${id}`, { method: "DELETE" })
      if (res.ok) {
        setGoals(prev => prev.filter(g => g.id !== id))
      } else {
        alert("Failed to delete goal")
      }
    } catch {
      alert("Network error deleting goal")
    }
  }

  async function handleRecalculate(id: string) {
    setCalculating(prev => ({ ...prev, [id]: true }))
    try {
      const res = await fetch(`/api/executive-goals/${id}/calculate`, { method: "POST" })
      if (res.ok) {
        const updated = await res.json()
        setGoals(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g))
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? "Failed to recalculate goal")
      }
    } catch {
      alert("Network error recalculating goal")
    } finally {
      setCalculating(prev => ({ ...prev, [id]: false }))
    }
  }

  const activeGoals = goals.filter(g => g.status === "ACTIVE" || g.status === "AT_RISK")
  const atRiskGoals = goals.filter(g => g.isAtRisk || g.status === "AT_RISK")
  const completedGoals = goals.filter(g => g.status === "ACHIEVED" || g.status === "MISSED")

  return (
    <div className="p-6 space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {goals.length} goal{goals.length !== 1 ? "s" : ""}
            {atRiskGoals.length > 0 && (
              <span className="ml-2 text-orange-600 font-medium">{atRiskGoals.length} at risk</span>
            )}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowForm(true); setEditGoal(null) }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Goal
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <GoalForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          loading={saving}
        />
      )}

      {/* Edit form */}
      {editGoal && (
        <GoalForm
          initial={{
            title: editGoal.title,
            description: editGoal.description ?? "",
            metricType: editGoal.metricType,
            targetValue: String(editGoal.targetValue),
            unit: editGoal.unit,
            targetDate: new Date(editGoal.targetDate).toISOString().split("T")[0],
            scope: editGoal.scope,
          }}
          onSubmit={handleEdit}
          onCancel={() => setEditGoal(null)}
          loading={saving}
        />
      )}

      {/* Empty state */}
      {goals.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center mb-4">
            <Target className="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No goals yet. {isAdmin ? 'Click "Create Goal" to get started.' : "No goals have been set yet."}
          </p>
        </div>
      )}

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Active Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                isAdmin={isAdmin}
                onRecalculate={handleRecalculate}
                onEdit={setEditGoal}
                onDelete={handleDelete}
                calculating={!!calculating[goal.id]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">Completed Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                isAdmin={isAdmin}
                onRecalculate={handleRecalculate}
                onEdit={setEditGoal}
                onDelete={handleDelete}
                calculating={!!calculating[goal.id]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

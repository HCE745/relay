"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Plus, Pencil, Trash2, Check, X, GitBranch } from "lucide-react"
import { cn } from "@/lib/utils"

interface Stage {
  id:                string
  stageNumber:       number
  name:              string
  daysAfterPrevious: number
  description:       string | null
}

function cumulativeDay(stages: Stage[], idx: number): number {
  let total = 0
  for (let i = 0; i <= idx; i++) total += stages[i].daysAfterPrevious
  return total
}

export default function StagesPage() {
  const [stages,   setStages]   = useState<Stage[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [addMode,  setAddMode]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState("")

  const [editForm, setEditForm] = useState({ name: "", daysAfterPrevious: 0, description: "" })
  const [addForm,  setAddForm]  = useState({ name: "", daysAfterPrevious: 7, description: "" })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/sales/stages")
      const data = await res.json() as { stages: Stage[] }
      setStages(data.stages ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function startEdit(s: Stage) {
    setEditId(s.id)
    setEditForm({ name: s.name, daysAfterPrevious: s.daysAfterPrevious, description: s.description ?? "" })
    setAddMode(false)
    setError("")
  }

  async function saveEdit(id: string) {
    if (!editForm.name.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/sales/stages/${id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(editForm),
      })
      if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? "Save failed"); return }
      setEditId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function deleteStage(id: string) {
    if (!confirm("Delete this stage?")) return
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/sales/stages/${id}`, { method: "DELETE" })
      if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? "Delete failed"); return }
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function addStage() {
    if (!addForm.name.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/sales/stages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(addForm),
      })
      if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? "Add failed"); return }
      setAddMode(false)
      setAddForm({ name: "", daysAfterPrevious: 7, description: "" })
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Follow-Up Stages</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Configure your outreach sequence. When an email is sent, Relay automatically schedules the next follow-up.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-800 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {stages.map((stage, idx) => {
            const cumDay  = cumulativeDay(stages, idx)
            const isEditing = editId === stage.id

            return (
              <div
                key={stage.id}
                className={cn(
                  "bg-gray-900 border rounded-xl overflow-hidden transition-colors",
                  isEditing ? "border-emerald-700/60" : "border-gray-800",
                )}
              >
                {isEditing ? (
                  <div className="px-4 py-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-emerald-400 px-2 py-0.5 bg-emerald-900/30 rounded-full">
                        Stage {stage.stageNumber}
                      </span>
                      {stage.stageNumber === 0 && (
                        <span className="text-xs text-gray-600">· Day 0 (sent immediately)</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Stage name</label>
                        <input
                          value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Days after previous stage
                        </label>
                        <input
                          type="number"
                          min={stage.stageNumber === 0 ? 0 : 1}
                          value={editForm.daysAfterPrevious}
                          onChange={e => setEditForm(f => ({ ...f, daysAfterPrevious: Number(e.target.value) }))}
                          disabled={stage.stageNumber === 0}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
                      <input
                        value={editForm.description}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="What this stage represents…"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => void saveEdit(stage.id)}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Save
                      </button>
                      <button
                        onClick={() => { setEditId(null); setError("") }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    {/* Stage badge */}
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full">
                        S{stage.stageNumber}
                      </span>
                      {idx < stages.length - 1 && (
                        <div className="w-px h-3 bg-gray-700" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{stage.name}</span>
                        {stage.description && (
                          <span className="text-xs text-gray-500">{stage.description}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {stage.stageNumber === 0
                          ? "Sent on day 0 · Initial outreach"
                          : `${stage.daysAfterPrevious}d after previous · Day ${cumDay} of sequence`}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(stage)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {stage.stageNumber !== 0 && (
                        <button
                          onClick={() => void deleteStage(stage.id)}
                          disabled={saving}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Add stage */}
          {addMode ? (
            <div className="bg-gray-900 border border-emerald-700/60 rounded-xl px-4 py-4 space-y-3">
              <p className="text-xs font-semibold text-gray-400">
                Stage {stages.length} · New Stage
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Stage name</label>
                  <input
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Final Touch"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Days after previous stage</label>
                  <input
                    type="number"
                    min={1}
                    value={addForm.daysAfterPrevious}
                    onChange={e => setAddForm(f => ({ ...f, daysAfterPrevious: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
                <input
                  value={addForm.description}
                  onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What this stage represents…"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => void addStage()}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add Stage
                </button>
                <button
                  onClick={() => { setAddMode(false); setError("") }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setAddMode(true); setEditId(null); setError("") }}
              className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-700 hover:border-emerald-700 rounded-xl text-sm text-gray-500 hover:text-emerald-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Stage
            </button>
          )}
        </div>
      )}

      <div className="mt-6 px-1 flex items-start gap-2 text-xs text-gray-600">
        <GitBranch className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <p>
          Stage 0 cannot be deleted. When you send an email, Relay tags it with the appropriate stage and
          sets the follow-up date based on the next stage&apos;s day offset.
        </p>
      </div>
    </div>
  )
}

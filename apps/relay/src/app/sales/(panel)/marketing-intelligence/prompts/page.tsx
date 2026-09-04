"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react"

interface Prompt {
  id:         string
  promptText: string
  category:   string
  isActive:   boolean
}

const CATEGORIES = ["brand", "use_case", "industry", "competitor", "pain_point"] as const

const CATEGORY_LABELS: Record<string, string> = {
  brand: "Brand", use_case: "Use Case", industry: "Industry",
  competitor: "Competitor", pain_point: "Pain Point",
}

const CATEGORY_COLORS: Record<string, string> = {
  brand:      "bg-blue-900/40 text-blue-300 border-blue-700/30",
  use_case:   "bg-purple-900/40 text-purple-300 border-purple-700/30",
  industry:   "bg-orange-900/40 text-orange-300 border-orange-700/30",
  competitor: "bg-red-900/40 text-red-300 border-red-700/30",
  pain_point: "bg-yellow-900/40 text-yellow-300 border-yellow-700/30",
}

export default function PromptsPage() {
  const [prompts, setPrompts]   = useState<Prompt[]>([])
  const [loading, setLoading]   = useState(true)
  const [editId,  setEditId]    = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [editCat, setEditCat]   = useState("")
  const [addMode, setAddMode]   = useState(false)
  const [addText, setAddText]   = useState("")
  const [addCat,  setAddCat]    = useState<string>("use_case")
  const [saving,  setSaving]    = useState(false)
  const [error,   setError]     = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/sales/visibility/prompts")
      const data = await res.json() as { prompts: Prompt[] }
      setPrompts(data.prompts ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function save(id: string) {
    if (!editText.trim()) { setError("Prompt text is required"); return }
    setSaving(true); setError("")
    try {
      await fetch(`/api/sales/visibility/prompts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptText: editText, category: editCat }),
      })
      setEditId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this prompt?")) return
    setSaving(true)
    try {
      await fetch(`/api/sales/visibility/prompts/${id}`, { method: "DELETE" })
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function add() {
    if (!addText.trim()) { setError("Prompt text is required"); return }
    setSaving(true); setError("")
    try {
      await fetch("/api/sales/visibility/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptText: addText, category: addCat }),
      })
      setAddMode(false); setAddText("")
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(p: Prompt) {
    await fetch(`/api/sales/visibility/prompts/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    })
    await load()
  }

  const byCategory = CATEGORIES.reduce<Record<string, Prompt[]>>((acc, cat) => {
    acc[cat] = prompts.filter(p => p.category === cat)
    return acc
  }, {} as Record<string, Prompt[]>)

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Visibility Prompts</h1>
          <p className="text-gray-400 text-sm mt-0.5">These are the questions we ask AI systems to measure Relay&apos;s visibility</p>
        </div>
        <button
          onClick={() => { setAddMode(true); setError("") }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Prompt
        </button>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-800 rounded-xl text-red-400 text-sm">{error}</div>}

      {addMode && (
        <div className="mb-6 bg-gray-900 border border-emerald-700/50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400">New Prompt</p>
          <textarea
            value={addText}
            onChange={e => setAddText(e.target.value)}
            placeholder="e.g. Best software for tracking operational issues…"
            rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 resize-none"
          />
          <div className="flex items-center gap-3">
            <select
              value={addCat}
              onChange={e => setAddCat(e.target.value)}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => void add()} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Add
              </button>
              <button onClick={() => { setAddMode(false); setError("") }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map(cat => {
            const ps = byCategory[cat] ?? []
            if (!ps.length) return null
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[cat]}`}>
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="text-xs text-gray-600">{ps.length} prompts</span>
                </div>
                <div className="space-y-1.5">
                  {ps.map(p => (
                    <div key={p.id} className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${editId === p.id ? "border-emerald-700/60" : "border-gray-800"}`}>
                      {editId === p.id ? (
                        <div className="p-3 space-y-2">
                          <textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                          />
                          <div className="flex items-center gap-2">
                            <select
                              value={editCat}
                              onChange={e => setEditCat(e.target.value)}
                              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                            >
                              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                            </select>
                            <div className="flex items-center gap-2 ml-auto">
                              <button onClick={() => void save(p.id)} disabled={saving}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg">
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                              </button>
                              <button onClick={() => { setEditId(null); setError("") }}
                                className="px-3 py-1.5 bg-gray-800 text-gray-400 text-xs rounded-lg hover:bg-gray-700">
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={p.isActive}
                            onChange={() => void toggleActive(p)}
                            title={p.isActive ? "Disable" : "Enable"}
                            className="mt-0.5 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                          />
                          <p className={`flex-1 text-sm leading-snug ${p.isActive ? "text-gray-200" : "text-gray-500 line-through"}`}>
                            {p.promptText}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => { setEditId(p.id); setEditText(p.promptText); setEditCat(p.category) }}
                              className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-gray-800 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => void del(p.id)} disabled={saving}
                              className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

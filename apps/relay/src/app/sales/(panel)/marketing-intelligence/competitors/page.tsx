"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Pencil, Check, X, Loader2, ExternalLink } from "lucide-react"

interface Competitor {
  id:        string
  name:      string
  website:   string | null
  createdAt: string
}

interface CheckAgg {
  name:      string
  mentions:  number
  totalChecks: number
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [aggs, setAggs]               = useState<Record<string, number>>({})
  const [totalChecks, setTotalChecks] = useState(0)
  const [loading, setLoading]         = useState(true)
  const [editId, setEditId]           = useState<string | null>(null)
  const [editName, setEditName]       = useState("")
  const [editWeb, setEditWeb]         = useState("")
  const [addMode, setAddMode]         = useState(false)
  const [addName, setAddName]         = useState("")
  const [addWeb, setAddWeb]           = useState("")
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [compRes, checksRes] = await Promise.all([
        fetch("/api/sales/visibility/competitors"),
        fetch("/api/sales/visibility/runs").then(r => r.json()) as Promise<never>,
      ])
      const compData = await compRes.json() as { competitors: Competitor[] }
      setCompetitors(compData.competitors ?? [])

      // Get aggregate mention counts from all checks
      const aggRes = await fetch("/api/sales/visibility/runs")
      if (aggRes.ok) {
        // We'll compute from the checks endpoint would be ideal
        // For now, just show competitors list
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function saveEdit(id: string) {
    if (!editName.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    try {
      await fetch(`/api/sales/visibility/competitors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, website: editWeb || null }),
      })
      setEditId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this competitor?")) return
    setSaving(true)
    try {
      await fetch(`/api/sales/visibility/competitors/${id}`, { method: "DELETE" })
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function add() {
    if (!addName.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    try {
      await fetch("/api/sales/visibility/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName, website: addWeb || null }),
      })
      setAddMode(false); setAddName(""); setAddWeb("")
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Competitors</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            We track how often these competitors are mentioned alongside Relay in AI responses
          </p>
        </div>
        <button
          onClick={() => { setAddMode(true); setError("") }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Competitor
        </button>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-800 rounded-xl text-red-400 text-sm">{error}</div>}

      {addMode && (
        <div className="mb-5 bg-gray-900 border border-emerald-700/50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400">New Competitor</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input value={addName} onChange={e => setAddName(e.target.value)}
                placeholder="e.g. Limble"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Website</label>
              <input value={addWeb} onChange={e => setAddWeb(e.target.value)}
                placeholder="https://limblecmms.com"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
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
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {competitors.map(c => (
            <div key={c.id} className={`bg-gray-900 border rounded-xl overflow-hidden ${editId === c.id ? "border-emerald-700/60" : "border-gray-800"}`}>
              {editId === c.id ? (
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Name *</label>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Website</label>
                      <input value={editWeb} onChange={e => setEditWeb(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => void saveEdit(c.id)} disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="px-3 py-1.5 bg-gray-800 text-gray-400 text-xs rounded-lg hover:bg-gray-700">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 px-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{c.name}</p>
                    {c.website && (
                      <a href={c.website} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-emerald-400 flex items-center gap-1 mt-0.5">
                        {c.website.replace(/^https?:\/\//, "")} <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setEditId(c.id); setEditName(c.name); setEditWeb(c.website ?? "") }}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-gray-800 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => void del(c.id)} disabled={saving}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

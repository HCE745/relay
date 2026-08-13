"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { X, Play, Loader2, Check, ChevronDown, ChevronRight } from "lucide-react"

interface Prompt {
  id:         string
  promptText: string
  category:   string
  isActive:   boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  brand:      "Brand",
  use_case:   "Use Case",
  industry:   "Industry",
  competitor: "Competitor",
  pain_point: "Pain Point",
}

const CATEGORY_COLORS: Record<string, string> = {
  brand:      "bg-blue-900/40 text-blue-300",
  use_case:   "bg-purple-900/40 text-purple-300",
  industry:   "bg-orange-900/40 text-orange-300",
  competitor: "bg-red-900/40 text-red-300",
  pain_point: "bg-yellow-900/40 text-yellow-300",
}

export function RunModal({ onClose }: { onClose?: () => void }) {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [prompts, setPrompts]   = useState<Prompt[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading]   = useState(false)
  const [running, setRunning]   = useState(false)
  const [error, setError]       = useState("")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch("/api/sales/visibility/prompts")
      .then(r => r.json())
      .then((d: { prompts: Prompt[] }) => {
        setPrompts(d.prompts ?? [])
        setSelected(new Set((d.prompts ?? []).filter(p => p.isActive).map(p => p.id)))
        const cats = [...new Set((d.prompts ?? []).map(p => p.category))]
        setExpanded(Object.fromEntries(cats.map(c => [c, true])))
      })
      .catch(() => setError("Failed to load prompts"))
      .finally(() => setLoading(false))
  }, [open])

  function toggle(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function selectCategory(cat: string, checked: boolean) {
    const ids = prompts.filter(p => p.category === cat).map(p => p.id)
    setSelected(s => {
      const n = new Set(s)
      ids.forEach(id => checked ? n.add(id) : n.delete(id))
      return n
    })
  }

  async function startRun() {
    if (!selected.size) { setError("Select at least one prompt"); return }
    setRunning(true); setError("")
    try {
      const res = await fetch("/api/sales/visibility/run", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ promptIds: [...selected], providers: ["anthropic"] }),
      })
      const data = await res.json() as { runId?: string; error?: string }
      if (!res.ok || !data.runId) { setError(data.error ?? "Run failed"); return }
      setOpen(false)
      onClose?.()
      router.push(`/sales/marketing-intelligence/results/${data.runId}`)
    } catch {
      setError("Network error — please try again")
    } finally {
      setRunning(false)
    }
  }

  const categories = [...new Set(prompts.map(p => p.category))]
  const estimatedCost = (selected.size * 0.01).toFixed(2)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        <Play className="w-4 h-4" />
        Run Visibility Check
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold">Run Visibility Check</h2>
            <p className="text-xs text-gray-500 mt-0.5">Ask AI systems your prompts and measure Relay&apos;s visibility</p>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provider */}
        <div className="px-5 py-3 border-b border-gray-800">
          <p className="text-xs font-semibold text-gray-400 mb-2">AI Provider</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/30 border border-emerald-700/50 rounded-lg">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm text-emerald-300 font-medium">Anthropic (Claude)</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/60 border border-gray-700 rounded-lg opacity-50 cursor-not-allowed">
              <span className="text-sm text-gray-500">OpenAI</span>
              <span className="text-[10px] text-gray-600 bg-gray-700 px-1.5 rounded">Soon</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/60 border border-gray-700 rounded-lg opacity-50 cursor-not-allowed">
              <span className="text-sm text-gray-500">Perplexity</span>
              <span className="text-[10px] text-gray-600 bg-gray-700 px-1.5 rounded">Soon</span>
            </div>
          </div>
        </div>

        {/* Prompts */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400">Prompts ({selected.size} selected)</p>
            <div className="flex gap-2">
              <button onClick={() => setSelected(new Set(prompts.map(p => p.id)))} className="text-[11px] text-emerald-400 hover:text-emerald-300">All</button>
              <span className="text-gray-700">·</span>
              <button onClick={() => setSelected(new Set())} className="text-[11px] text-gray-400 hover:text-gray-300">None</button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => {
                const catPrompts = prompts.filter(p => p.category === cat)
                const allSel = catPrompts.every(p => selected.has(p.id))
                const someSel = catPrompts.some(p => selected.has(p.id))
                const isOpen = expanded[cat] !== false

                return (
                  <div key={cat} className="border border-gray-800 rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-800/60 hover:bg-gray-800 transition-colors"
                      onClick={() => setExpanded(e => ({ ...e, [cat]: !isOpen }))}
                    >
                      <input
                        type="checkbox"
                        checked={allSel}
                        ref={el => { if (el) el.indeterminate = !allSel && someSel }}
                        onChange={e => { e.stopPropagation(); selectCategory(cat, e.target.checked) }}
                        onClick={e => e.stopPropagation()}
                        className="rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat] ?? "bg-gray-700 text-gray-300"}`}>
                        {CATEGORY_LABELS[cat] ?? cat}
                      </span>
                      <span className="text-xs text-gray-500 flex-1 text-left">{catPrompts.length} prompts</span>
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-600" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
                    </button>
                    {isOpen && (
                      <div className="divide-y divide-gray-800/60">
                        {catPrompts.map(p => (
                          <label key={p.id} className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-800/30">
                            <input
                              type="checkbox"
                              checked={selected.has(p.id)}
                              onChange={() => toggle(p.id)}
                              className="mt-0.5 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-gray-300 leading-snug">{p.promptText}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800">
          {error && (
            <p className="text-red-400 text-xs mb-3">{error}</p>
          )}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              <span className="text-gray-300">{selected.size} prompts</span> × $0.01 ≈{" "}
              <span className="text-emerald-400 font-medium">${estimatedCost}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void startRun()}
                disabled={running || !selected.size}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {running ? "Running…" : "Start Check"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

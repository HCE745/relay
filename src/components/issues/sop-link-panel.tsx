"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Link2, Unlink, ChevronDown, ChevronUp } from "lucide-react"

interface SOP {
  id: string
  title: string
  category: string | null
}

interface Props {
  issueId: string
  currentSopId: string | null
  currentSopTitle: string | null
  currentSopLinkSource: string | null
  sopMatchConfidence: number | null
  availableSOPs: SOP[]
  defaultCollapsed: boolean
}

export function SopLinkPanel({
  issueId,
  currentSopId,
  currentSopTitle,
  currentSopLinkSource,
  sopMatchConfidence,
  availableSOPs,
  defaultCollapsed,
}: Props) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [loading, setLoading] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selectedId, setSelectedId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const Chevron = collapsed ? ChevronDown : ChevronUp

  async function handleLink() {
    if (!selectedId) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/issues/${issueId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sopId: selectedId }),
    })
    if (res.ok) {
      setSelecting(false)
      setSelectedId("")
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      setError((d as { error?: string }).error ?? "Failed to link SOP")
    }
    setLoading(false)
  }

  async function handleUnlink() {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/issues/${issueId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sopId: null }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      setError((d as { error?: string }).error ?? "Failed to unlink SOP")
    }
    setLoading(false)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors
          ${!collapsed ? "border-b border-gray-200" : ""}`}
      >
        <BookOpen className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">SOP Linking</span>
        <Chevron className="w-3.5 h-3.5 text-gray-400 ml-auto shrink-0" />
      </button>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">{error}</p>
          )}

          {currentSopId ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">
                    Linked SOP
                    {currentSopLinkSource === "AI" && sopMatchConfidence !== null && (
                      <span className="ml-1 text-blue-500">· AI matched ({Math.round(sopMatchConfidence * 100)}%)</span>
                    )}
                    {currentSopLinkSource === "MANUAL" && (
                      <span className="ml-1 text-green-600">· Manually linked</span>
                    )}
                  </p>
                  <a
                    href={`/sops/${currentSopId}`}
                    className="text-sm font-medium text-blue-700 hover:underline"
                  >
                    {currentSopTitle}
                  </a>
                </div>
                <button
                  onClick={handleUnlink}
                  disabled={loading}
                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50 shrink-0"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Unlink
                </button>
              </div>
              <button
                onClick={() => setSelecting(v => !v)}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <Link2 className="w-3 h-3" />
                Switch to a different SOP
                <ChevronDown className={`w-3 h-3 transition-transform ${selecting ? "rotate-180" : ""}`} />
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">No SOP linked to this issue.</p>
          )}

          {(!currentSopId || selecting) && (
            <div className="flex gap-2 items-center">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— select a SOP —</option>
                {availableSOPs.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title}{s.category ? ` (${s.category})` : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={handleLink}
                disabled={!selectedId || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <Link2 className="w-3.5 h-3.5" />
                Link
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

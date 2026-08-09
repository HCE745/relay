"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  BookOpen, Upload, Plus, FileText, AlertTriangle, ChevronRight,
  X, Check, Loader2, Pencil, Trash2, AlertCircle, Clock, Sparkles,
} from "lucide-react"
import { ISSUE_CATEGORY } from "@/lib/constants"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"

const ASSET_TYPES = ["EQUIPMENT", "VEHICLE", "FACILITY", "TOOL", "TECHNOLOGY", "OTHER"]
const CATEGORY_COLOR: Record<string, string> = {
  GENERAL:             "bg-gray-100 text-gray-700",
  MAINTENANCE:         "bg-blue-100 text-blue-700",
  SAFETY:              "bg-red-100 text-red-700",
  EQUIPMENT_BREAKDOWN: "bg-orange-100 text-orange-700",
  FACILITY:            "bg-indigo-100 text-indigo-700",
  EMPLOYEE:            "bg-pink-100 text-pink-700",
  CUSTOMER_COMPLAINT:  "bg-yellow-100 text-yellow-700",
  SUPPLY_SHORTAGE:     "bg-teal-100 text-teal-700",
}

interface Department { id: string; name: string }
interface SopCard {
  id: string
  title: string
  description: string | null
  category: string | null
  assetType: string | null
  version: string
  department: Department | null
  linkedIssueCount: number
  updatedAt: string
  uploadedFilename: string | null
}

interface UploadSuggested {
  title: string
  description: string
  category: string
  assetType: string
  version: string
}

interface UploadResult {
  content: string
  filename: string
  sections: Array<{ index: number; heading: string; body: string }> | null
  suggested: UploadSuggested
}

interface Props {
  initialSops: SopCard[]
  departments: Department[]
  isAdminLevel: boolean
}

// ─── Manual Create Form ───────────────────────────────────────────────────────

function CreateForm({
  departments,
  onSave,
  onCancel,
  saving,
}: {
  departments: Department[]
  onSave: (data: {
    title: string; description: string | null; category: string | null
    departmentId: string | null; assetType: string | null; content: string; version: string
  }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [title, setTitle]         = useState("")
  const [description, setDesc]    = useState("")
  const [category, setCategory]   = useState("")
  const [departmentId, setDeptId] = useState("")
  const [assetType, setAssetType] = useState("")
  const [content, setContent]     = useState("")
  const [version, setVersion]     = useState("1.0")

  const inputCls  = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const selectCls = `${inputCls} bg-white`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Create SOP Manually</h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Forklift Operation Safety" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Version</label>
              <input value={version} onChange={e => setVersion(e.target.value)} className={inputCls} placeholder="1.0" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input value={description} onChange={e => setDesc(e.target.value)} className={inputCls} placeholder="Brief summary of what this SOP covers" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls}>
                <option value="">All categories</option>
                {Object.entries(ISSUE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select value={departmentId} onChange={e => setDeptId(e.target.value)} className={selectCls}>
                <option value="">Any department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Asset type</label>
              <select value={assetType} onChange={e => setAssetType(e.target.value)} className={selectCls}>
                <option value="">Any asset</option>
                {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Content *</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={10}
              className={`${inputCls} resize-y font-mono text-xs`}
              placeholder="Write the full SOP here. Use plain text or markdown.&#10;&#10;1. Step one...&#10;2. Step two..."
            />
          </div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            disabled={saving || !title.trim() || !content.trim()}
            onClick={() => onSave({
              title: title.trim(),
              description: description.trim() || null,
              category: category || null,
              assetType: assetType || null,
              content: content.trim(),
              version: version.trim() || "1.0",
              departmentId: departmentId || null,
            })}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save SOP"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Upload Review Screen ─────────────────────────────────────────────────────

function UploadReview({
  result,
  departments,
  onSave,
  onCancel,
  saving,
}: {
  result: UploadResult
  departments: Department[]
  onSave: (data: {
    title: string; description: string | null; category: string | null
    departmentId: string | null; assetType: string | null; content: string; version: string
    uploadedFilename: string
    sections: Array<{ index: number; heading: string; body: string }> | null
  }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [title, setTitle]         = useState(result.suggested.title)
  const [description, setDesc]    = useState(result.suggested.description)
  const [category, setCategory]   = useState(result.suggested.category)
  const [departmentId, setDeptId] = useState("")
  const [assetType, setAssetType] = useState(result.suggested.assetType === "GENERAL" ? "" : result.suggested.assetType)
  const [version, setVersion]     = useState(result.suggested.version)

  const inputCls  = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const selectCls = `${inputCls} bg-white`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">Review AI-Suggested Metadata</h3>
            <p className="text-xs text-gray-500 mt-0.5">AI analyzed &ldquo;{result.filename}&rdquo; — review and adjust before saving</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            These fields were suggested by AI based on your document. Edit any field before accepting.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Version</label>
              <input value={version} onChange={e => setVersion(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input value={description} onChange={e => setDesc(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls}>
                <option value="">All categories</option>
                {Object.entries(ISSUE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select value={departmentId} onChange={e => setDeptId(e.target.value)} className={selectCls}>
                <option value="">Any department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Asset type</label>
              <select value={assetType} onChange={e => setAssetType(e.target.value)} className={selectCls}>
                <option value="">Any asset</option>
                {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Extracted Content (preview)</label>
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 max-h-40 overflow-y-auto">
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">
                {result.content.slice(0, 800)}{result.content.length > 800 ? "\n…" : ""}
              </pre>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            disabled={saving || !title.trim()}
            onClick={() => onSave({
              title: title.trim(),
              description: description.trim() || null,
              category: category || null,
              assetType: assetType || null,
              content: result.content,
              version: version.trim() || "1.0",
              departmentId: departmentId || null,
              uploadedFilename: result.filename,
              sections: result.sections ?? null,
            })}
            className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Accept & Save SOP"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Library ─────────────────────────────────────────────────────────────

export function SopLibrary({ initialSops, departments, isAdminLevel }: Props) {
  const router = useRouter()
  const [sops, setSops]           = useState(initialSops)
  const [filter, setFilter]       = useState("")
  const [error, setError]         = useState("")
  const [saving, setSaving]       = useState(false)
  const [showCreate, setShowCreate]   = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [suggestingId, setSuggestingId]     = useState<string | null>(null)
  const [suggestions, setSuggestions]       = useState<Record<string, string[]>>({})

  function isStale(sop: SopCard): boolean {
    const daysSince = (Date.now() - new Date(sop.updatedAt).getTime()) / 86_400_000
    return daysSince > 90 && sop.linkedIssueCount >= 3
  }

  async function handleSuggestUpdates(sopId: string) {
    setSuggestingId(sopId)
    try {
      const res = await fetch(`/api/sops/${sopId}/suggest-updates`, { method: "POST" })
      if (res.ok) {
        const d = await res.json() as { suggestions: string[] }
        setSuggestions(prev => ({ ...prev, [sopId]: d.suggestions }))
      }
    } catch {/* non-critical */} finally {
      setSuggestingId(null)
    }
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setUploading(true)
    setError("")
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/sops/upload", { method: "POST", body: formData })
      const data = await res.json() as { error?: string } & UploadResult
      if (!res.ok) { setError(data.error ?? "Upload failed"); setUploading(false); return }
      setUploadResult(data)
    } catch {
      setError("Upload failed — please try again")
    }
    setUploading(false)
  }

  async function handleSave(data: {
    title: string; description: string | null; category: string | null
    departmentId: string | null; assetType: string | null; content: string; version: string
    uploadedFilename?: string
    sections?: Array<{ index: number; heading: string; body: string }> | null
  }) {
    setSaving(true); setError("")
    const res = await fetch("/api/sops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    setSaving(false)
    if (res.ok) {
      const sop = await res.json() as SopCard & { _count?: { issues: number }; updatedAt: string }
      setSops(prev => [{
        id: sop.id,
        title: sop.title,
        description: sop.description,
        category: sop.category,
        assetType: sop.assetType,
        version: sop.version,
        department: sop.department,
        linkedIssueCount: 0,
        updatedAt: sop.updatedAt,
        uploadedFilename: sop.uploadedFilename ?? null,
      }, ...prev])
      setShowCreate(false)
      setUploadResult(null)
    } else {
      const d = await res.json() as { error?: string }
      setError(d.error ?? "Failed to save")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deactivate this SOP? It will no longer appear in the library.")) return
    const res = await fetch(`/api/sops/${id}`, { method: "DELETE" })
    if (res.ok) {
      setSops(prev => prev.filter(s => s.id !== id))
    } else {
      const d = await res.json() as { error?: string }
      setError(d.error ?? "Failed to delete")
    }
  }

  const filtered = filter.trim()
    ? sops.filter(s =>
        s.title.toLowerCase().includes(filter.toLowerCase()) ||
        s.description?.toLowerCase().includes(filter.toLowerCase()) ||
        s.department?.name.toLowerCase().includes(filter.toLowerCase())
      )
    : sops

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search SOPs…"
          className="flex-1 min-w-0 px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {isAdminLevel && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={handleUploadFile}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shrink-0 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Analyzing…" : "Upload SOP"}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Create SOP
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Stats row */}
      {sops.length > 0 && (
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <span><strong className="text-gray-900">{sops.length}</strong> SOP{sops.length !== 1 ? "s" : ""}</span>
          <span><strong className="text-gray-900">{sops.reduce((t, s) => t + s.linkedIssueCount, 0)}</strong> total linked issues</span>
        </div>
      )}

      {/* SOP Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">
            {filter ? "No SOPs match your search." : "No SOPs in the library yet."}
          </p>
          {isAdminLevel && !filter && (
            <p className="text-gray-400 text-xs mt-1">Upload an existing document or create one from scratch.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sop => (
            <div
              key={sop.id}
              className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-3 p-4">
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  {sop.uploadedFilename
                    ? <FileText className="w-4.5 h-4.5 text-blue-600" />
                    : <BookOpen className="w-4.5 h-4.5 text-blue-600" />
                  }
                </div>

                {/* Main content — clickable to detail */}
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => router.push(`/sops/${sop.id}`)}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-semibold text-gray-900 text-sm group-hover:text-blue-700 transition-colors">
                      {sop.title}
                    </span>
                    <span className="text-xs text-gray-400">v{sop.version}</span>
                    {sop.category && (
                      <Badge className={`text-[10px] ${CATEGORY_COLOR[sop.category] ?? "bg-gray-100 text-gray-700"}`}>
                        {ISSUE_CATEGORY[sop.category as keyof typeof ISSUE_CATEGORY] ?? sop.category}
                      </Badge>
                    )}
                    {sop.department && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        {sop.department.name}
                      </span>
                    )}
                    {isStale(sop) && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                        <Clock className="w-2.5 h-2.5" /> Stale
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {sop.linkedIssueCount > 0 ? (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="w-3 h-3" />
                        {sop.linkedIssueCount} linked {sop.linkedIssueCount === 1 ? "issue" : "issues"}
                      </span>
                    ) : (
                      <span>No linked issues</span>
                    )}
                    <span>Updated {formatDistanceToNow(new Date(sop.updatedAt), { addSuffix: true })}</span>
                    {sop.uploadedFilename && (
                      <span className="text-blue-400">Uploaded</span>
                    )}
                  </div>
                  {/* AI Suggestions panel */}
                  {suggestions[sop.id] && (
                    <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                      <p className="font-medium text-blue-700 mb-1">Suggested updates:</p>
                      <ul className="space-y-0.5">
                        {suggestions[sop.id].map((s, i) => (
                          <li key={i} className="text-blue-600 flex items-start gap-1">
                            <span className="mt-0.5 shrink-0">•</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </button>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {isStale(sop) && isAdminLevel && (
                    <button
                      onClick={() => handleSuggestUpdates(sop.id)}
                      disabled={suggestingId === sop.id}
                      title="AI Suggest Updates"
                      className="p-1.5 rounded-lg text-amber-400 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                    >
                      {suggestingId === sop.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/sops/${sop.id}`)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {isAdminLevel && (
                    <button
                      onClick={() => handleDelete(sop.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"
                      title="Deactivate"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateForm
          departments={departments}
          onSave={handleSave}
          onCancel={() => setShowCreate(false)}
          saving={saving}
        />
      )}

      {uploadResult && (
        <UploadReview
          result={uploadResult}
          departments={departments}
          onSave={handleSave}
          onCancel={() => setUploadResult(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

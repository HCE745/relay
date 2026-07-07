"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BookOpen, FileText, AlertTriangle, Sparkles, Clock, Package, Pencil,
  Check, X, Loader2, AlertCircle, TrendingUp, Calendar, ExternalLink, Lightbulb,
} from "lucide-react"
import { ISSUE_CATEGORY, ISSUE_STATUS, ISSUE_PRIORITY, PRIORITY_COLOR, STATUS_COLOR } from "@/lib/constants"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow, format } from "date-fns"

const ASSET_TYPES = ["EQUIPMENT", "VEHICLE", "FACILITY", "TOOL", "TECHNOLOGY", "OTHER"]
const CATEGORY_COLOR: Record<string, string> = {
  GENERAL: "bg-gray-100 text-gray-700", MAINTENANCE: "bg-blue-100 text-blue-700",
  SAFETY: "bg-red-100 text-red-700", EQUIPMENT_BREAKDOWN: "bg-orange-100 text-orange-700",
  FACILITY: "bg-indigo-100 text-indigo-700", EMPLOYEE: "bg-pink-100 text-pink-700",
  CUSTOMER_COMPLAINT: "bg-yellow-100 text-yellow-700", SUPPLY_SHORTAGE: "bg-teal-100 text-teal-700",
}

type Tab = "content" | "issues" | "insights" | "history"
type IssueFilter = "all" | "violations" | "resolved"

interface SOPSection { index: number; heading: string; body: string }

interface LinkedIssue {
  id: string
  title: string
  status: string
  priority: string
  category: string
  sopViolation: boolean
  sopMatchConfidence: number | null
  sopViolationNote: string | null
  sopComplianceOutcome: string | null
  createdAt: string
  resolvedAt: string | null
  reportedBy: { id: string; name: string }
  asset: { id: string; name: string } | null
}

interface SopData {
  id: string
  title: string
  description: string | null
  category: string | null
  assetType: string | null
  content: string
  version: string
  uploadedFilename: string | null
  sections: SOPSection[] | null
  aiImprovementSuggestion: string | null
  aiImprovementGeneratedAt: string | null
  department: { id: string; name: string } | null
  linkedIssueCount: number
  updatedAt: string
  createdAt: string
  issues: LinkedIssue[]
}

interface RelatedAsset { id: string; name: string; type: string }
interface Department { id: string; name: string }

interface Props {
  sop: SopData
  departments: Department[]
  relatedAssets: RelatedAsset[]
  isAdminLevel: boolean
  canViewImprovement: boolean
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color = pct >= 80 ? "bg-green-100 text-green-700" : pct >= 65 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${color}`}>
      {pct}% match
    </span>
  )
}

function EditForm({
  sop,
  departments,
  onSave,
  onCancel,
  saving,
}: {
  sop: SopData
  departments: Department[]
  onSave: (data: Partial<SopData>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [title, setTitle]         = useState(sop.title)
  const [description, setDesc]    = useState(sop.description ?? "")
  const [category, setCategory]   = useState(sop.category ?? "")
  const [departmentId, setDeptId] = useState(sop.department?.id ?? "")
  const [assetType, setAssetType] = useState(sop.assetType ?? "")
  const [content, setContent]     = useState(sop.content)
  const [version, setVersion]     = useState(sop.version)

  const inputCls  = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const selectCls = `${inputCls} bg-white`

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Edit SOP</h3>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
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
        <label className="block text-xs font-medium text-gray-600 mb-1">Content *</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={12}
          className={`${inputCls} resize-y font-mono text-xs`}
        />
      </div>
      <div className="flex gap-2">
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
            department: departments.find(d => d.id === departmentId) ?? null,
          })}
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  )
}

export function SopDetailView({ sop: initialSop, departments, relatedAssets, isAdminLevel, canViewImprovement }: Props) {
  const router = useRouter()
  const [sop, setSop]       = useState(initialSop)
  const [tab, setTab]       = useState<Tab>("content")
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("all")
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const [generatingImprovement, setGeneratingImprovement] = useState(false)
  const [improvementRequested, setImprovementRequested] = useState(false)

  const violationCount    = sop.issues.filter(i => i.sopViolation).length
  const autoMatchedCount  = sop.issues.filter(i => i.sopMatchConfidence !== null && !i.sopViolation).length
  const resolvedCount     = sop.issues.filter(i => i.status === "RESOLVED").length

  async function handleSave(data: Partial<SopData>) {
    setSaving(true); setError("")
    const res = await fetch(`/api/sops/${sop.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        departmentId: (data.department as Department | null)?.id ?? null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json() as SopData
      setSop(prev => ({
        ...prev,
        title:       updated.title ?? prev.title,
        description: updated.description ?? prev.description,
        category:    updated.category ?? prev.category,
        assetType:   updated.assetType ?? prev.assetType,
        content:     updated.content ?? prev.content,
        version:     updated.version ?? prev.version,
        department:  (updated as { department?: Department }).department ?? prev.department,
      }))
      setEditing(false)
    } else {
      const d = await res.json() as { error?: string }
      setError(d.error ?? "Failed to save")
    }
  }

  async function handleGenerateImprovement() {
    setGeneratingImprovement(true)
    setError("")
    const res = await fetch(`/api/sops/${sop.id}/improve`, { method: "POST" })
    setGeneratingImprovement(false)
    if (res.ok) {
      setImprovementRequested(true)
    } else {
      const d = await res.json() as { error?: string }
      setError(d.error ?? "Failed to generate improvement")
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "content",  label: "Content" },
    { key: "issues",   label: "Linked Issues", count: sop.linkedIssueCount },
    ...(canViewImprovement ? [{ key: "insights" as Tab, label: "AI Insights" }] : []),
    { key: "history",  label: "Incident Timeline", count: sop.issues.length },
  ]

  if (editing) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}
        <EditForm sop={sop} departments={departments} onSave={handleSave} onCancel={() => setEditing(false)} saving={saving} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* SOP Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
              {sop.uploadedFilename
                ? <FileText className="w-5 h-5 text-blue-600" />
                : <BookOpen className="w-5 h-5 text-blue-600" />
              }
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{sop.title}</h1>
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                <span className="text-xs text-gray-400">v{sop.version}</span>
                {sop.category && (
                  <Badge className={`text-xs ${CATEGORY_COLOR[sop.category] ?? "bg-gray-100 text-gray-700"}`}>
                    {ISSUE_CATEGORY[sop.category as keyof typeof ISSUE_CATEGORY] ?? sop.category}
                  </Badge>
                )}
                {sop.assetType && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{sop.assetType}</span>
                )}
                {sop.department && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{sop.department.name}</span>
                )}
                {sop.uploadedFilename && (
                  <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                    Uploaded: {sop.uploadedFilename}
                  </span>
                )}
              </div>
              {sop.description && (
                <p className="text-sm text-gray-500 mt-2">{sop.description}</p>
              )}
            </div>
          </div>
          {isAdminLevel && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>

        {/* Stats row — each stat is a link to the Linked Issues tab (with optional filter) */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
          <button
            type="button"
            onClick={() => { setTab("issues"); setIssueFilter("all") }}
            className="text-center rounded-lg py-1.5 hover:bg-gray-50 transition-colors group"
          >
            <div className="text-2xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{sop.linkedIssueCount}</div>
            <div className="text-xs text-gray-400 mt-0.5 group-hover:text-blue-500 transition-colors">Linked Issues</div>
          </button>
          <button
            type="button"
            onClick={() => { setTab("issues"); setIssueFilter("violations") }}
            className="text-center rounded-lg py-1.5 hover:bg-red-50 transition-colors group"
          >
            <div className="text-2xl font-bold text-red-600">{violationCount}</div>
            <div className="text-xs text-gray-400 mt-0.5 group-hover:text-red-500 transition-colors">SOP Violations</div>
          </button>
          <button
            type="button"
            onClick={() => { setTab("issues"); setIssueFilter("resolved") }}
            className="text-center rounded-lg py-1.5 hover:bg-green-50 transition-colors group"
          >
            <div className="text-2xl font-bold text-green-600">{resolvedCount}</div>
            <div className="text-xs text-gray-400 mt-0.5 group-hover:text-green-500 transition-colors">Resolved</div>
          </button>
        </div>
      </div>

      {/* AI Improvement suggestion (when available and prominent) — restricted to authorized roles */}
      {canViewImprovement && sop.aiImprovementSuggestion && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Lightbulb className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-semibold text-amber-800">AI Improvement Suggestion</span>
                {sop.aiImprovementGeneratedAt && (
                  <span className="text-xs text-amber-500">
                    Generated {formatDistanceToNow(new Date(sop.aiImprovementGeneratedAt), { addSuffix: true })}
                  </span>
                )}
              </div>
              <p className="text-sm text-amber-900 leading-relaxed">{sop.aiImprovementSuggestion}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content tab */}
      {tab === "content" && (
        <div className="space-y-4">
          {/* Related Assets */}
          {relatedAssets.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                Related Assets
                <span className="text-xs text-gray-400 font-normal">
                  {sop.assetType ? `(${sop.assetType} type)` : ""}
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {relatedAssets.map(a => (
                  <Link
                    key={a.id}
                    href={`/assets/${a.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-lg text-sm text-gray-700 hover:text-blue-700 transition-colors"
                  >
                    <Package className="w-3.5 h-3.5" />
                    {a.name}
                    <span className="text-xs text-gray-400">{a.type}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Full SOP content */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">SOP Content</h3>
            <div className="bg-gray-50 rounded-lg border border-gray-100 p-4">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                {sop.content}
              </pre>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Last updated {formatDistanceToNow(new Date(sop.updatedAt), { addSuffix: true })} · Created {format(new Date(sop.createdAt), "MMM d, yyyy")}
            </p>
          </div>
        </div>
      )}

      {/* Linked Issues tab */}
      {tab === "issues" && (
        <div className="space-y-3">
          {sop.issues.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <AlertTriangle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No issues linked to this SOP yet.</p>
              <p className="text-xs text-gray-400 mt-1">Issues are linked automatically when AI detects relevance, or when manually flagged.</p>
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-400 flex items-center gap-3 flex-wrap">
                <span>{sop.linkedIssueCount} total linked issues</span>
                <span>·</span>
                <span>{violationCount} confirmed violations</span>
                <span>·</span>
                <span>{autoMatchedCount} AI-matched (no confirmed violation)</span>
                {issueFilter !== "all" && (
                  <>
                    <span>·</span>
                    <span className={`font-medium px-1.5 py-0.5 rounded ${
                      issueFilter === "violations" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                    }`}>
                      {issueFilter === "violations" ? "Showing violations only" : "Showing resolved only"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIssueFilter("all")}
                      className="text-gray-400 hover:text-gray-700 underline"
                    >
                      Clear filter
                    </button>
                  </>
                )}
              </div>
              {sop.issues
                .filter(issue => {
                  if (issueFilter === "violations") return issue.sopViolation
                  if (issueFilter === "resolved") return issue.status === "RESOLVED"
                  return true
                })
                .map(issue => (
                <div key={issue.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={PRIORITY_COLOR[issue.priority] ?? "bg-gray-100 text-gray-700"}>
                          {ISSUE_PRIORITY[issue.priority as keyof typeof ISSUE_PRIORITY] ?? issue.priority}
                        </Badge>
                        <Badge className={STATUS_COLOR[issue.status] ?? "bg-gray-100 text-gray-700"}>
                          {ISSUE_STATUS[issue.status as keyof typeof ISSUE_STATUS] ?? issue.status}
                        </Badge>
                        {issue.sopViolation && (
                          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">
                            <AlertCircle className="w-3 h-3" />
                            SOP Violation
                          </span>
                        )}
                        {issue.sopMatchConfidence !== null && (
                          <ConfidenceBadge confidence={issue.sopMatchConfidence} />
                        )}
                      </div>
                      <Link href={`/issues/${issue.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-700 flex items-center gap-1">
                        {issue.title}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </Link>
                      {issue.sopViolationNote && (
                        <p className="text-xs text-red-600 mt-1 italic">{issue.sopViolationNote}</p>
                      )}
                      {issue.sopComplianceOutcome && (
                        <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          issue.sopComplianceOutcome === "SOP_NON_COMPLIANCE" ? "bg-red-100 text-red-700" :
                          issue.sopComplianceOutcome === "SOP_DEFICIENCY"     ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>
                          {issue.sopComplianceOutcome === "SOP_NON_COMPLIANCE" ? "Non-Compliance" :
                           issue.sopComplianceOutcome === "SOP_DEFICIENCY"     ? "SOP Deficiency" :
                           "Unrelated"}
                        </span>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>By {issue.reportedBy.name}</span>
                        {issue.asset && <span>· {issue.asset.name}</span>}
                        <span>· {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* AI Insights tab */}
      {tab === "insights" && (
        <div className="space-y-4">
          {/* Improvement suggestion management */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">AI Improvement Suggestion</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {sop.linkedIssueCount >= 10
                      ? `Based on ${sop.linkedIssueCount} linked incidents, AI can suggest SOP improvements.`
                      : `Available when this SOP has 10+ linked issues (currently ${sop.linkedIssueCount}).`
                    }
                  </p>
                </div>
              </div>
              {canViewImprovement && sop.linkedIssueCount >= 10 && !improvementRequested && (
                <button
                  onClick={handleGenerateImprovement}
                  disabled={generatingImprovement}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-60 shrink-0"
                >
                  {generatingImprovement ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {generatingImprovement ? "Generating…" : sop.aiImprovementSuggestion ? "Regenerate" : "Generate"}
                </button>
              )}
            </div>

            {improvementRequested && !sop.aiImprovementSuggestion && (
              <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-100 text-sm text-purple-700">
                Improvement analysis queued — refresh this page in a few moments to see the result.
              </div>
            )}

            {sop.aiImprovementSuggestion && (
              <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-900 leading-relaxed">{sop.aiImprovementSuggestion}</p>
                {sop.aiImprovementGeneratedAt && (
                  <p className="text-xs text-amber-500 mt-2">
                    Generated {formatDistanceToNow(new Date(sop.aiImprovementGeneratedAt), { addSuffix: true })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Pattern insights from linked issues */}
          {sop.issues.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                Pattern Analysis
              </h3>
              <div className="space-y-3">
                {/* Violation rate */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">SOP violation rate</span>
                  <span className={`font-semibold ${violationCount / sop.issues.length > 0.3 ? "text-red-600" : "text-gray-900"}`}>
                    {sop.issues.length > 0 ? Math.round((violationCount / sop.issues.length) * 100) : 0}%
                    <span className="text-xs font-normal text-gray-400 ml-1">({violationCount}/{sop.issues.length})</span>
                  </span>
                </div>

                {/* Resolution rate */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Resolved</span>
                  <span className="font-semibold text-green-600">
                    {resolvedCount}/{sop.issues.length}
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      ({sop.issues.length > 0 ? Math.round((resolvedCount / sop.issues.length) * 100) : 0}%)
                    </span>
                  </span>
                </div>

                {/* Priority breakdown */}
                {(() => {
                  const priorityCounts: Record<string, number> = {}
                  sop.issues.forEach(i => { priorityCounts[i.priority] = (priorityCounts[i.priority] ?? 0) + 1 })
                  const topPriority = Object.entries(priorityCounts).sort((a, b) => b[1] - a[1])[0]
                  return topPriority ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Most common priority</span>
                      <Badge className={PRIORITY_COLOR[topPriority[0]] ?? "bg-gray-100 text-gray-700"}>
                        {ISSUE_PRIORITY[topPriority[0] as keyof typeof ISSUE_PRIORITY] ?? topPriority[0]}
                        <span className="ml-1 opacity-70">({topPriority[1]})</span>
                      </Badge>
                    </div>
                  ) : null
                })()}

                {/* AI match confidence avg */}
                {autoMatchedCount > 0 && (() => {
                  const avgConf = sop.issues
                    .filter(i => i.sopMatchConfidence !== null)
                    .reduce((sum, i) => sum + (i.sopMatchConfidence ?? 0), 0) / autoMatchedCount
                  return (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Avg AI match confidence</span>
                      <span className="font-semibold text-gray-900">{Math.round(avgConf * 100)}%</span>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {sop.issues.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Sparkles className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No incident data to analyze yet.</p>
              <p className="text-xs text-gray-400 mt-1">Insights will appear after this SOP accumulates linked issues.</p>
            </div>
          )}
        </div>
      )}

      {/* Incident History / Timeline tab */}
      {tab === "history" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            Incident Timeline
          </h3>

          {sop.issues.length === 0 ? (
            <div className="text-center py-10">
              <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No incidents recorded yet.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
              <div className="space-y-4">
                {sop.issues.map((issue, i) => (
                  <div key={issue.id} className="flex items-start gap-4 pl-10 relative">
                    <div className={`absolute left-3 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      issue.sopViolation ? "bg-red-500" :
                      issue.status === "RESOLVED" ? "bg-green-500" :
                      i === 0 ? "bg-blue-500" : "bg-gray-300"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <Link href={`/issues/${issue.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-700 flex items-center gap-1">
                            {issue.title}
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {issue.sopViolation && (
                              <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Violation</span>
                            )}
                            {issue.sopMatchConfidence !== null && (
                              <ConfidenceBadge confidence={issue.sopMatchConfidence} />
                            )}
                            <span className="text-xs text-gray-400">By {issue.reportedBy.name}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-gray-400">{format(new Date(issue.createdAt), "MMM d, yyyy")}</div>
                          {issue.resolvedAt && (
                            <div className="text-xs text-green-500 mt-0.5">
                              Resolved {formatDistanceToNow(new Date(issue.resolvedAt), { addSuffix: true })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
